//! GitHub Releases-based self-updater for Lumina Launcher.
//!
//! The flow is fully driven from the Rust side:
//!   1. [`check_for_update`] queries `GET /repos/<owner>/<repo>/releases/latest`
//!      (with a `Bearer` token when the repo is private), compares the release
//!      tag against the running version, and selects the installer asset for
//!      the current OS/arch.
//!   2. [`download_update`] streams that asset to `app_data_dir/updates/`,
//!      emitting progress, and sanity-checks the result (size + optional
//!      `.sha256` checksum).
//!   3. [`install_update`] hands the file to the platform installer and reports
//!      the outcome.
//!
//! Every step emits a status through the `update://status` event
//! (`up_to_date`, `update_available`, `downloading`, `installing`,
//! `ready_to_restart`, `error`) plus a `update://progress` event while
//! downloading, which the frontend toast subscribes to. All of this runs in
//! the background — the app stays usable while the check/download proceeds.
//!
//! Private-repo token: read from the `GITHUB_TOKEN` env var at *build time*
//! (CI bakes the `LUMINA_UPDATE_TOKEN` secret into it — see
//! `.github/workflows/lumina-launcher-build.yml`), with a runtime fallback for
//! local dev. This is inherently a soft protection: a token shipped inside a
//! client app can always be extracted.

use serde::{Deserialize, Serialize};
use serde::ser::SerializeStruct;
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use thiserror::Error;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const GITHUB_API_BASE: &str = "https://api.github.com";
const REPO_OWNER: &str = "zoxenzz";
const REPO_NAME: &str = "LuminaLauncher";
const USER_AGENT: &str = concat!("LuminaLauncher/", env!("CARGO_PKG_VERSION"), " (auto-updater)");

/// Names of pre-release builds that must never be offered as updates.
const BLACKLIST_PREFIXES: &[&str] = &[
    "dev",
    "nightly",
    "dirty",
    "dirty-dev",
    "dirty-nightly",
    "dirty_dev",
    "dirty_nightly",
];

const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(100);

#[cfg(target_os = "windows")]
const WINDOWS_EXIT_GRACE: Duration = Duration::from_millis(1500);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A release asset, matching the GitHub Releases API shape.
///
/// `browser_download_url` 404s for private repos even with a valid token, so
/// downloads always go through the API `url` with an
/// `Accept: application/octet-stream` header (which GitHub redirects to a
/// signed file URL).
///
/// Serializes as camelCase (matching the frontend `LauncherReleaseAsset`
/// interface) but accepts **both** camelCase and GitHub's snake_case on
/// deserialize — the GitHub API sends `browser_download_url`/
/// `content_type`, so a bare `#[serde(rename_all = "camelCase")]` would
/// fail to decode releases.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: u64,
    pub name: String,
    /// API asset URL (`.../releases/assets/{id}`) — must be used for downloads.
    pub url: String,
    #[serde(rename = "browserDownloadUrl", alias = "browser_download_url")]
    pub browser_download_url: String,
    #[serde(rename = "contentType", alias = "content_type")]
    pub content_type: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Release {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub assets: Vec<Asset>,
}

/// High-level status of the update pipeline, serialized into the
/// `update://status` event (and returned from `updater_check`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum UpdateStatus {
    Checking,
    UpToDate,
    UpdateAvailable {
        version: String,
        notes: Option<String>,
        size: Option<u64>,
    },
    Downloading {
        version: String,
    },
    Installing {
        version: String,
    },
    ReadyToRestart {
        version: String,
        /// Whether the frontend may auto-restart after a short countdown
        /// (e.g. after a `.deb` install) instead of waiting for the user.
        auto_restart: bool,
    },
    Error {
        message: String,
    },
}

/// Payload of the `update://progress` event while streaming the installer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressPayload {
    pub downloaded: u64,
    pub total: Option<u64>,
}

/// Returned by `updater_check`: the status plus the full release payload so
/// the frontend can show changelog details and offer a manual download.
#[derive(Debug, Clone, Serialize)]
pub struct UpdateCheckResult {
    pub status: UpdateStatus,
    pub release: Option<Release>,
}

#[derive(Debug, Error)]
pub enum UpdateError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("Update request failed with HTTP status {0}")]
    BadStatus(u16),
    #[error("{0}")]
    Message(String),
}

impl Serialize for UpdateError {
    fn serialize<S: serde::Serializer>(
        &self,
        serializer: S,
    ) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("UpdateError", 2)?;
        state.serialize_field("field_name", "UpdateError")?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

// ---------------------------------------------------------------------------
// Event helpers
// ---------------------------------------------------------------------------

fn emit_status(app: &AppHandle, status: &UpdateStatus) {
    if let Err(e) = app.emit("update://status", status) {
        tracing::warn!("[updater] Failed to emit update://status: {e}");
    }
}

fn emit_progress(app: &AppHandle, payload: ProgressPayload) {
    if let Err(e) = app.emit("update://progress", payload) {
        tracing::warn!("[updater] Failed to emit update://progress: {e}");
    }
}

// ---------------------------------------------------------------------------
// Version + asset selection
// ---------------------------------------------------------------------------

/// Strips a leading `v`/`V` and splits on `.`/`-`, keeping only numeric parts
/// (so `release-1.2.3`, `v1.2.3` and `1.2.3` all normalize to `[1, 2, 3]`).
/// Mirrors the previous frontend implementation in
/// `apps/app-frontend/src/helpers/lumina/update.ts`.
fn parse_version_parts(version: &str) -> Vec<u64> {
    version
        .trim()
        .trim_start_matches(|c| c == 'v' || c == 'V')
        .split(|c: char| c == '.' || c == '-')
        .filter_map(|part| part.parse::<u64>().ok())
        .collect()
}

fn compare_versions(left: &str, right: &str) -> Ordering {
    let left_parts = parse_version_parts(left);
    let right_parts = parse_version_parts(right);
    let max_length = left_parts.len().max(right_parts.len());

    for index in 0..max_length {
        let left_part = left_parts.get(index).copied().unwrap_or(0);
        let right_part = right_parts.get(index).copied().unwrap_or(0);
        match left_part.cmp(&right_part) {
            Ordering::Equal => continue,
            other => return other,
        }
    }

    Ordering::Equal
}

fn os_extensions() -> &'static [&'static str] {
    match std::env::consts::OS {
        "windows" => &[".exe", ".msi"],
        "macos" => &[".dmg", ".pkg", ".app"],
        _ => &[".deb", ".AppImage"],
    }
}

/// Matches the architecture tokens used in this project's release asset names
/// (`x64`/`x86_64`/`amd64` for Intel/AMD, `arm64`/`aarch64` for ARM). The
/// macOS arm64 DMGs are named `..._aarch64.dmg`, so matching on "arm64" alone
/// would silently fall back to the wrong asset on Apple Silicon.
fn matches_arch(name: &str, want_arm: bool) -> bool {
    if want_arm {
        name.contains("arm64") || name.contains("aarch64")
    } else {
        name.contains("x64") || name.contains("x86_64") || name.contains("amd64")
    }
}

/// Picks the installer for the current OS/arch: prefers the one whose name
/// carries the architecture token, falling back to any matching-OS installer.
/// Skips pre-release (`dev`/`nightly`/`dirty`) assets.
fn select_asset(release: &Release) -> Option<&Asset> {
    let extensions = os_extensions();
    let want_arm = std::env::consts::ARCH.contains("arm");

    let candidates = release
        .assets
        .iter()
        .filter(|asset| {
            !BLACKLIST_PREFIXES
                .iter()
                .any(|prefix| asset.name.starts_with(prefix))
                && extensions.iter().any(|ext| asset.name.ends_with(ext))
        })
        .collect::<Vec<_>>();

    candidates
        .iter()
        .find(|asset| matches_arch(&asset.name, want_arm))
        .copied()
        .or_else(|| candidates.first().copied())
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Returns the private-repo token baked in at build time, or the one exported
/// at runtime (dev machines). `None` when the repo is public.
fn update_token() -> Option<String> {
    option_env!("GITHUB_TOKEN")
        .map(str::to_owned)
        .or_else(|| std::env::var("GITHUB_TOKEN").ok().filter(|t| !t.is_empty()))
}

/// `app_data_dir/updates/` — where installers are staged before installation.
fn updates_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
        .join("updates")
}

/// Removes other staged installers (and stale `.part` files) from the updates
/// directory so it doesn't grow without bound. The just-downloaded file is
/// always kept. Deleting `.part` files is safe because a download is only
/// ever in flight from the frontend, which guards concurrent downloads with
/// `downloadInFlight`.
async fn cleanup_stale_installers(updates_dir: &Path, keep: &Path) {
    const INSTALLER_EXTENSIONS: &[&str] =
        &[".exe", ".msi", ".dmg", ".pkg", ".app", ".deb", ".AppImage"];

    let Ok(mut entries) = tokio::fs::read_dir(updates_dir).await else {
        return;
    };
    while let Ok(Some(entry)) = entries.next_entry().await {
        let path = entry.path();
        if path == keep {
            continue;
        }
        let Some(name) = path.file_name().and_then(|f| f.to_str()) else {
            continue;
        };
        let is_installer = INSTALLER_EXTENSIONS.iter().any(|ext| name.ends_with(ext))
            || name.ends_with(".part");
        if is_installer {
            let _ = tokio::fs::remove_file(&path).await;
        }
    }
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// Checks GitHub Releases for a newer version and emits the result through
/// `update://status`. Returns the status + full release payload (when an
/// update is available) for the frontend.
pub async fn check_for_update(app: &AppHandle) -> Result<UpdateCheckResult, UpdateError> {
    emit_status(app, &UpdateStatus::Checking);

    let mut request = reqwest::Client::new()
        .get(format!(
            "{GITHUB_API_BASE}/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"
        ))
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, USER_AGENT);
    if let Some(token) = update_token() {
        request = request.bearer_auth(token);
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        let message = format!("GitHub releases request failed with HTTP {status}");
        tracing::error!("[updater] {message}");
        emit_status(
            app,
            &UpdateStatus::Error {
                message: message.clone(),
            },
        );
        return Err(UpdateError::BadStatus(status));
    }
    let release: Release = response.json().await?;

    let local_version = app.package_info().version.to_string();
    if compare_versions(&release.tag_name, &local_version) != Ordering::Greater {
        tracing::info!("[updater] Already up to date ({local_version})");
        emit_status(app, &UpdateStatus::UpToDate);
        return Ok(UpdateCheckResult {
            status: UpdateStatus::UpToDate,
            release: None,
        });
    }

    let Some(asset) = select_asset(&release) else {
        let message = format!(
            "No installer asset found for {} {} in release {}",
            std::env::consts::OS,
            std::env::consts::ARCH,
            release.tag_name
        );
        tracing::warn!("[updater] {message}");
        emit_status(
            app,
            &UpdateStatus::Error {
                message: message.clone(),
            },
        );
        return Err(UpdateError::Message(message));
    };

    let version = release.tag_name.clone();
    tracing::info!("[updater] Update available: {version} ({})", asset.name);
    let status = UpdateStatus::UpdateAvailable {
        version: version.clone(),
        notes: release.body.clone(),
        size: asset.size,
    };
    emit_status(app, &status);

    Ok(UpdateCheckResult {
        status,
        release: Some(release),
    })
}

/// Streams the given release asset into `app_data_dir/updates/`, emitting
/// `update://progress` as it goes. Verifies the download is complete (matching
/// the expected size) and optionally checks a `.sha256` sibling asset.
pub async fn download_update(
    app: &AppHandle,
    asset: &Asset,
    sha256_url: Option<String>,
    version: &str,
) -> Result<PathBuf, UpdateError> {
    emit_status(
        app,
        &UpdateStatus::Downloading {
            version: version.to_string(),
        },
    );

    let updates_dir = updates_dir(app);
    tokio::fs::create_dir_all(&updates_dir).await?;
    let filename = sanitize_filename(&asset.name);
    let final_path = updates_dir.join(&filename);
    let part_path = updates_dir.join(format!("{filename}.part"));

    // Private repos: the plain browser_download_url 404s, so download via the
    // API asset URL with `Accept: application/octet-stream`.
    let mut request = reqwest::Client::new()
        .get(&asset.url)
        .header(reqwest::header::ACCEPT, "application/octet-stream")
        .header(reqwest::header::USER_AGENT, USER_AGENT);
    if let Some(token) = update_token() {
        request = request.bearer_auth(token);
    }

    let mut response = request.send().await?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        tracing::error!(
            "[updater] Download request failed with HTTP {status} for {}",
            asset.name
        );
        return Err(UpdateError::BadStatus(status));
    }

    let total = response.content_length().or(asset.size);
    let mut downloaded: u64 = 0;
    let mut last_emit = Instant::now();
    let mut file = tokio::fs::File::create(&part_path).await?;

    while let Some(chunk) = response.chunk().await? {
        downloaded += chunk.len() as u64;
        file.write_all(&chunk).await?;
        if last_emit.elapsed() >= PROGRESS_EMIT_INTERVAL {
            emit_progress(
                app,
                ProgressPayload {
                    downloaded,
                    total,
                },
            );
            last_emit = Instant::now();
        }
    }
    file.flush().await?;
    drop(file);

    emit_progress(
        app,
        ProgressPayload {
            downloaded,
            total,
        },
    );

    // Basic sanity checks: never install an empty or truncated download.
    if downloaded == 0 {
        return Err(UpdateError::Message(
            "Downloaded update is empty".to_string(),
        ));
    }
    if let Some(expected) = total
        && downloaded != expected
    {
        let message = format!("Downloaded {downloaded} bytes but expected {expected}");
        tracing::error!("[updater] {message}");
        return Err(UpdateError::Message(message));
    }

    if let Some(sha256_url) = sha256_url {
        verify_sha256(&part_path, &sha256_url).await?;
    }

    tokio::fs::rename(&part_path, &final_path).await?;
    cleanup_stale_installers(&updates_dir, &final_path).await;
    tracing::info!("[updater] Downloaded update to {}", final_path.display());
    Ok(final_path)
}

/// Verifies a downloaded file against a `.sha256` checksum asset (GitHub
/// publishes those as sibling assets on the release).
async fn verify_sha256(path: &Path, sha256_url: &str) -> Result<(), UpdateError> {
    let mut request = reqwest::Client::new()
        .get(sha256_url)
        .header(reqwest::header::ACCEPT, "application/octet-stream")
        .header(reqwest::header::USER_AGENT, USER_AGENT);
    if let Some(token) = update_token() {
        request = request.bearer_auth(token);
    }

    let text = request.send().await?.error_for_status()?.text().await?;
    let expected = text.split_whitespace().next().unwrap_or_default().to_lowercase();
    if expected.len() != 64 || !expected.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(UpdateError::Message(format!(
            "Invalid .sha256 content: {text}"
        )));
    }

    let mut hasher = Sha256::new();
    let mut file = tokio::fs::File::open(path).await?;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).await?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let actual = format!("{:x}", hasher.finalize());

    if actual != expected {
        let message = format!("Checksum mismatch: expected {expected}, got {actual}");
        tracing::error!("[updater] {message}");
        return Err(UpdateError::Message(message));
    }
    tracing::info!("[updater] Checksum verified for {}", path.display());
    Ok(())
}

/// Hands the downloaded installer to the platform-specific installer and emits
/// the outcome through `update://status`.
///
/// Platform notes:
/// * **Windows** — the NSIS/MSI installer cannot overwrite a running
///   executable, so we launch it silently and then quit the app; the installer
///   finishes in the background and the next launch runs the new version.
/// * **macOS** — we can only `open` the `.dmg` (mounts it); the user drags the
///   new `.app` into `/Applications`. No auto-restart.
/// * **Linux (.AppImage)** — replace the running AppImage on disk and restart
///   (safe on Linux, which keeps the old mapping alive until exit).
/// * **Linux (.deb)** — install via `pkexec dpkg -i`, which shows a polkit
///   privilege prompt (elevated permissions are unavoidable for `.deb`). If
///   `pkexec` is unavailable we fall back to opening the file manually.
pub async fn install_update(
    app: &AppHandle,
    path: &Path,
    version: &str,
) -> Result<(), UpdateError> {
    emit_status(
        app,
        &UpdateStatus::Installing {
            version: version.to_string(),
        },
    );
    tracing::info!(
        "[updater] Installing update {version} from {}",
        path.display()
    );

    #[cfg(target_os = "windows")]
    {
        let filename = path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or_default()
            .to_lowercase();
        spawn_windows_installer(path, &filename).await?;
        // Give the installer a moment to start, then quit so it can replace
        // the running executable.
        tokio::time::sleep(WINDOWS_EXIT_GRACE).await;
        app.exit(0);
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        // `open` mounts the DMG in Finder; the user completes the install by
        // dragging the app into /Applications.
        std::process::Command::new("open").arg(path).spawn()?;
        emit_status(
            app,
            &UpdateStatus::ReadyToRestart {
                version: version.to_string(),
                auto_restart: false,
            },
        );
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let filename = path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or_default()
            .to_lowercase();
        if filename.ends_with(".appimage") {
            replace_appimage(app, path).await
        } else if filename.ends_with(".deb") {
            install_deb(app, path, version).await
        } else {
            Err(UpdateError::Message(format!(
                "Unsupported Linux installer: {filename}"
            )))
        }
    }
}

#[cfg(target_os = "windows")]
async fn spawn_windows_installer(path: &Path, filename: &str) -> Result<(), UpdateError> {
    if filename.ends_with(".msi") {
        let installer = path.to_string_lossy().into_owned();
        tokio::process::Command::new("msiexec")
            .args(["/i", installer.as_str(), "/quiet", "/norestart"])
            .spawn()?;
    } else {
        // NSIS silent-install flag. The child is detached; install_update()
        // quits the app shortly after so the executable is not locked.
        tokio::process::Command::new(path).arg("/S").spawn()?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
async fn replace_appimage(app: &AppHandle, path: &Path) -> Result<(), UpdateError> {
    use std::os::unix::fs::PermissionsExt;

    // The running binary is the AppImage itself. Replacing it on disk is safe
    // while it is running (the old mapping stays alive until exit) and takes
    // effect on the next launch.
    let current_exe = std::env::current_exe()?;
    let executable = std::fs::Permissions::from_mode(0o755);
    tokio::fs::set_permissions(path, executable.clone()).await?;
    tokio::fs::copy(path, &current_exe).await?;
    tokio::fs::set_permissions(&current_exe, executable).await?;

    tracing::info!(
        "[updater] Replaced {}; restarting into the new version",
        current_exe.display()
    );
    // `restart` diverges (`-> !`), so it must be the tail expression.
    app.restart()
}

#[cfg(target_os = "linux")]
async fn install_deb(app: &AppHandle, path: &Path, version: &str) -> Result<(), UpdateError> {
    // Installing a .deb requires root; pkexec surfaces a polkit auth prompt.
    let installer = path.to_string_lossy().into_owned();
    match tokio::process::Command::new("pkexec")
        .args(["dpkg", "-i", installer.as_str()])
        .status()
        .await
    {
        Ok(status) if status.success() => {
            tracing::info!("[updater] .deb installed via pkexec; restarting to apply");
            emit_status(
                app,
                &UpdateStatus::ReadyToRestart {
                    version: version.to_string(),
                    auto_restart: true,
                },
            );
            Ok(())
        }
        Ok(status) => {
            let message = format!("dpkg install failed (exit code {:?})", status.code());
            tracing::error!("[updater] {message}");
            Err(UpdateError::Message(message))
        }
        Err(e) => {
            tracing::warn!("[updater] pkexec unavailable ({e}); opening installer manually");
            let _ = std::process::Command::new("xdg-open").arg(path).spawn();
            emit_status(
                app,
                &UpdateStatus::ReadyToRestart {
                    version: version.to_string(),
                    auto_restart: false,
                },
            );
            Ok(())
        }
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Checks for an update. Emits `update://status` events and returns the
/// status + release payload (used by the frontend toast and the update modal).
#[tauri::command]
pub async fn updater_check(app: AppHandle) -> Result<UpdateCheckResult, UpdateError> {
    check_for_update(&app).await
}

/// Downloads the given release asset. Emits `update://status` +
/// `update://progress`. Returns the path to the staged installer.
#[tauri::command]
pub async fn updater_download(
    app: AppHandle,
    asset: Asset,
    version: String,
    sha256_url: Option<String>,
) -> Result<String, UpdateError> {
    let path = download_update(&app, &asset, sha256_url, &version).await?;
    Ok(path.to_string_lossy().into_owned())
}

/// Installs the staged installer and emits the outcome through
/// `update://status`. May quit/restart the app (see [`install_update`]).
#[tauri::command]
pub async fn updater_install(
    app: AppHandle,
    path: String,
    version: String,
) -> Result<(), UpdateError> {
    install_update(&app, Path::new(&path), &version).await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn asset(name: &str) -> Asset {
        Asset {
            id: 1,
            name: name.to_string(),
            url: "https://api.github.com/repos/zoxenzz/LuminaLauncher/releases/assets/1"
                .to_string(),
            browser_download_url: format!(
                "https://github.com/zoxenzz/LuminaLauncher/releases/download/x/{name}"
            ),
            content_type: None,
            size: None,
        }
    }

    /// The real asset names from the `release-1.2.0` release.
    fn release_120() -> Release {
        Release {
            tag_name: "release-1.2.0".to_string(),
            name: None,
            body: None,
            assets: [
                "Lumina.Launcher_1.2.0_aarch64.dmg",
                "Lumina.Launcher_1.2.0_amd64.AppImage",
                "Lumina.Launcher_1.2.0_amd64.deb",
                "Lumina.Launcher_1.2.0_arm64-setup.exe",
                "Lumina.Launcher_1.2.0_arm64_en-US.msi",
                "Lumina.Launcher_1.2.0_x64-setup.exe",
                "Lumina.Launcher_1.2.0_x64.dmg",
                "Lumina.Launcher_1.2.0_x64_en-US.msi",
            ]
            .iter()
            .map(|name| asset(name))
            .collect(),
        }
    }

    #[test]
    fn arch_matching_matches_real_asset_names() {
        // ARM tokens
        assert!(matches_arch("Lumina.Launcher_1.2.0_aarch64.dmg", true));
        assert!(matches_arch("Lumina.Launcher_1.2.0_arm64-setup.exe", true));
        assert!(matches_arch("Lumina.Launcher_1.2.0_arm64_en-US.msi", true));
        // x86 tokens
        assert!(matches_arch("Lumina.Launcher_1.2.0_x64.dmg", false));
        assert!(matches_arch("Lumina.Launcher_1.2.0_x64-setup.exe", false));
        assert!(matches_arch("Lumina.Launcher_1.2.0_x64_en-US.msi", false));
        assert!(matches_arch("Lumina.Launcher_1.2.0_amd64.deb", false));
        assert!(matches_arch("Lumina.Launcher_1.2.0_amd64.AppImage", false));
        // Cross-arch must NOT match
        assert!(!matches_arch("Lumina.Launcher_1.2.0_aarch64.dmg", false));
        assert!(!matches_arch("Lumina.Launcher_1.2.0_x64.dmg", true));
        assert!(!matches_arch("Lumina.Launcher_1.2.0_amd64.deb", true));
    }

    #[test]
    fn os_extension_filtering_matches_real_asset_names() {
        let release = release_120();
        let exts = |os: &str| match os {
            "windows" => &[".exe", ".msi"][..],
            "macos" => &[".dmg", ".pkg", ".app"][..],
            _ => &[".deb", ".AppImage"][..],
        };
        let count = |os: &str| {
            release
                .assets
                .iter()
                .filter(|a| exts(os).iter().any(|e| a.name.ends_with(e)))
                .count()
        };
        assert_eq!(count("windows"), 4);
        assert_eq!(count("macos"), 2);
        assert_eq!(count("linux"), 2);
    }

    /// The GitHub API sends snake_case asset fields; the frontend sends
    /// camelCase. Both must decode into the same struct (regression: a bare
    /// `#[serde(rename_all = "camelCase")]` broke decoding of GitHub JSON).
    #[test]
    fn asset_decodes_from_github_snake_case() {
        let json = r#"{
            "id": 503771831,
            "name": "Lumina.Launcher_1.2.2_x64-setup.exe",
            "url": "https://api.github.com/repos/zoxenzz/LuminaLauncher/releases/assets/503771831",
            "browser_download_url": "https://github.com/zoxenzz/LuminaLauncher/releases/download/release-1.2.2/Lumina.Launcher_1.2.2_x64-setup.exe",
            "content_type": "application/x-msdownload",
            "size": 14765964
        }"#;
        let asset: Asset = serde_json::from_str(json).expect("snake_case should decode");
        assert_eq!(asset.name, "Lumina.Launcher_1.2.2_x64-setup.exe");
        assert_eq!(asset.size, Some(14765964));
        assert_eq!(asset.content_type.as_deref(), Some("application/x-msdownload"));
    }

    #[test]
    fn asset_decodes_from_frontend_camel_case() {
        let json = r#"{
            "id": 1,
            "name": "Lumina.Launcher_1.2.2_x64-setup.exe",
            "url": "https://api.github.com/repos/zoxenzz/LuminaLauncher/releases/assets/1",
            "browserDownloadUrl": "https://github.com/example/download.exe",
            "contentType": "application/x-msdownload",
            "size": 12345
        }"#;
        let asset: Asset = serde_json::from_str(json).expect("camelCase should decode");
        assert_eq!(asset.name, "Lumina.Launcher_1.2.2_x64-setup.exe");
        assert_eq!(asset.browser_download_url, "https://github.com/example/download.exe");
    }

    #[test]
    fn asset_serializes_to_camel_case_for_frontend() {
        let asset = asset("Lumina.Launcher_1.2.2_x64-setup.exe");
        let json = serde_json::to_value(asset).unwrap();
        assert!(json.get("browserDownloadUrl").is_some());
        assert!(json.get("browser_download_url").is_none());
        assert!(json.get("id").is_some());
    }

    #[test]
    fn version_comparison_matches_tag_convention() {
        assert_eq!(
            compare_versions("release-1.2.2", "1.2.1"),
            Ordering::Greater
        );
        assert_eq!(
            compare_versions("v1.2.0", "release-1.2.1"),
            Ordering::Less
        );
        assert_eq!(compare_versions("1.2.0", "release-1.2.0"), Ordering::Equal);
        assert_eq!(
            compare_versions("release-1.2.10", "release-1.2.9"),
            Ordering::Greater
        );
    }
}
