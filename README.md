# 📘 Navigation

- [🔧 Install Instructions](#install-instructions)
- [✨ Features](#features)
- [🚀 Getting Started](#getting-started)
- [🔐 Code Signing and Notarization (CI Setup)](#code-signing-and-notarization-ci-setup)
- [⚠️ Disclaimer](#disclaimer)
- [💰 Donate](#support-our-project-crypto-wallets)

## Other languages
> [Русский](readme/ru_ru/README.md)

## Support channel
> [GitHub Issues](https://github.com/YOUR_GITHUB_USERNAME/LuminaLauncher/issues)

---

# About Project

## **Lumina Launcher • Empowering Your Minecraft Experience**

**Lumina Launcher** — a powerful fork of Modrinth, reimagined to enhance your Minecraft journey. Whether you're a GUI enthusiast or a developer building with Modrinth’s API, **Theseus Core** is your launchpad into a new era of Minecraft gameplay.

## **About the Software**

**Lumina Launcher** is a dedicated branch of the Modrinth (a.k.a Theseus) project, focused on **offline authentication**, offering you more flexibility and control. Play Minecraft without the need for constant online verification — a user-first approach to modern modded gaming.

---

# Install Instructions

To install the launcher:

1. Visit the [releases page](https://github.com/YOUR_GITHUB_USERNAME/LuminaLauncher/releases) to download the correct version for your system.
2. Run the downloaded file or extract and launch it, depending on the format.

### Downloadable File Extensions

| Extension | OS      | Notes                                                                 |
| --------- | ------- | --------------------------------------------------------------------- |
| `.msi`    | Windows | Supported on all recent Windows versions (10/11)                              |
| `.dmg`    | macOS   | Works on Ventura, Sonoma, Sequoia, Tahoe _(may also support older versions)_ |
| `.deb`    | Linux   | Basic support; compatibility may vary by distribution                 |

### Installation Warnings

Avoid using builds with these prefixes — they may be unstable or experimental:

- `dev`
- `nightly`
- `dirty`
- `dirty-dev`
- `dirty-nightly`
- `dirty_dev`
- `dirty_nightly`

---

# Features

> _The launcher provides an opportunity to use the well-known Modrinth, but with an improved user experience._

## Included exclusive features

- No ads in the entire launcher.
- Custom `.svg` vector icons for a distinct UI.
- Improved compatibility with both licensed and offline accounts.
  - Use **official microsoft accounts** or **offline accounts**.
  - Supports license-free access for testing or personal use.
  - No dependence on official authentication services.
- Discord Rich Presence integration:
  - Dynamic status messages.
  - In-game timer and AFK counter.
- Strict disabling of statistics and other Modrinth metrics.
- Optimized archive/package size.
- Integrated update fetcher for seamless version management.
  - Built-in update alerts for new versions posted on GitHub Releases.
  - Automatic download and installation capabilities.
- Database migration fixes, when error occurred (Interactive Mode) (Modrinth issue)
- Ely.by full integration
  - The official account skin system is managed by ely.by
  - Offline accounts must install AuthLib through the instance settings

---

# Getting Started

To begin using Lumina Launcher:

1. **Download Latest Release**

   - Go to the [releases page](https://github.com/YOUR_GITHUB_USERNAME/LuminaLauncher/releases)
   - [How to choose a file](#downloadable-file-extensions)
   - [How to choose a release](#installation-warnings)

2. **Log in or create new offline account**

   - Use your official Microsoft account (MSA), or test using a non-licensed account (Offline).

3. **Launch Minecraft**
   - Start Minecraft from the launcher.
   - The launcher will auto-detect the recommended JVM version.
   - You can also configure Java manually in the settings.

---

# 🔐 Code Signing and Notarization (CI Setup)

> These steps are **optional** — they only matter if you want the CI pipeline
> ([`.github/workflows/lumina-launcher-build.yml`](.github/workflows/lumina-launcher-build.yml))
> to publish **signed** installers so Windows SmartScreen / macOS Gatekeeper stop
> warning users about an "Unknown Publisher". If you skip this, CI keeps building
> unsigned installers and simply prints a warning for each missing secret.

## Secrets summary

| Secret | What it is |
| --- | --- |
| `MACOS_CERTIFICATE` | base64 of your **Developer ID Application** certificate exported as a `.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | the password you set on that `.p12` |
| `APPLE_API_KEY` | base64 of your App Store Connect API key (the `.p8` file) |
| `APPLE_API_KEY_ID` | the API key ID (e.g. `ABC123DEF4`) |
| `APPLE_API_ISSUER` | the API key Issuer ID |
| `WINDOWS_CERTIFICATE` *(optional)* | base64 of a Windows code-signing certificate (`.pfx`) from a CA such as DigiCert or Sectigo |
| `WINDOWS_CERTIFICATE_PASSWORD` *(optional)* | the password of that `.pfx` |

The CI workflow strips whitespace/newlines from the base64 values automatically, so you can paste the wrapped output of `base64` / `certutil` as-is.

## Part 1 — macOS: export the "Developer ID Application" `.p12`

This certificate signs the app; notarization (Part 2) then clears Gatekeeper for macOS users. Requires a paid [Apple Developer Program](https://developer.apple.com/programs/) membership.

**1. Create a Certificate Signing Request (CSR)**

1. On a Mac, open **Keychain Access** (`/Applications/Utilities/Keychain Access.app`).
2. Menu bar → **Keychain Access ▸ Certificate Assistant ▸ Request a Certificate From a Certificate Authority…**
3. Enter your Apple ID email and a name (e.g. `Lumina Launcher CI`), select **Saved to disk**, then **Continue**.
   This writes a `.certSigningRequest` file.

**2. Create the certificate in the Apple Developer portal**

1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list).
2. Click **+** → under *Software* select **Developer ID Application** → **Continue**.
3. Upload the `.certSigningRequest` from step 1 → **Continue** → **Download** the `.cer` file.

**3. Install it and export the `.p12`**

1. Double-click the downloaded `.cer` — it installs into **Keychain Access** (Login keychain, *My Certificates*).
2. In Keychain Access, open the **My Certificates** category and find **Developer ID Application: …**. Expand it and make sure the **private key** is nested underneath (it is, because the CSR was created on this Mac).
3. Right-click the certificate → **Export "…"** (some Keychain versions show **Export 2 items…**).
4. Keep **Personal Information Exchange (.p12)** and save the file.
5. When prompted, **set a password** — this exact password becomes the `MACOS_CERTIFICATE_PASSWORD` secret.

**4. Base64-encode the `.p12`**

macOS:

```bash
base64 -i Certificates.p12
```

Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('Certificates.p12'))
```

Paste the output into the `MACOS_CERTIFICATE` secret.

## Part 2 — macOS: create the App Store Connect API key (for notarization)

> ⚠️ The `.p8` file can only be downloaded **once**. Save it somewhere safe.

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) → **Users and Access** → **Keys** tab
   (or open `https://appstoreconnect.apple.com/access/api` directly).
2. Click **+** (or **Generate API Key**):
   - Name it, e.g. `Lumina Launcher CI`.
   - Set the access level to **Developer** (the minimum role required for notarization).
3. Click **Generate**, then **Download** the `.p8` file — the file is named `AuthKey_<KEY_ID>.p8`.
4. Copy the **Key ID** from the keys list (e.g. `ABC123DEF4`).
5. Copy the **Issuer ID** shown near the top of the Keys page.
6. Base64-encode the `.p8` (same commands as in Part 1, pointing at the `.p8` file).
7. Add the values to GitHub secrets:
   - `APPLE_API_KEY` ← base64 of the `.p8`
   - `APPLE_API_KEY_ID` ← the Key ID
   - `APPLE_API_ISSUER` ← the Issuer ID

## Part 3 — add the secrets to GitHub Actions

1. Open your repository → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** for each secret you want to enable.
3. Trigger a release build (push a `release-*` / `beta-*` tag) and check the workflow log:
   - macOS jobs print `✅ Apple code-signing credentials configured` and `✅ Apple notarization API key configured`.
   - Windows jobs print `Signing <path>` for every `.exe` / `.msi`.

## What happens in CI

- **macOS** — if `MACOS_CERTIFICATE` + `MACOS_CERTIFICATE_PASSWORD` are set, Tauri signs the `.app`
  (Developer ID + hardened runtime) during `tauri build`. If the API-key secrets are also set, the app is
  **notarized and stapled** automatically, so macOS users see no Gatekeeper warning.
- **Windows** — if `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD` are set, the `.exe` / `.msi`
  installers are signed with `signtool` (SHA-256 + RFC 3161 timestamp) before being uploaded.
- Missing secrets never fail the build — the matching step is skipped with a `::warning::`.

## Verifying a signed build

- **Windows:** right-click the downloaded installer → **Properties** → **Digital Signatures** — your certificate should be listed with "This digital signature is OK."
- **macOS:** download the `.dmg`, open it, and the app should launch without Gatekeeper complaining
  (on a Mac you can also run `codesign --verify --deep --strict` on the `.app` inside the DMG).

---

# Disclaimer

- **Lumina Launcher** is intended **solely for educational and experimental use**.
- We **do not condone piracy** — users are encouraged to purchase a legitimate Minecraft license.
- Respect all relevant licensing agreements and support Minecraft developers.

---

# Support Our Project (Crypto Wallets)

If you'd like to support development, you can donate via the following crypto wallets:

- Toncoin (TON): UQA5pGOJhIz9UAVEOh5t2ur1QVbNr_FC1eq9bOb3GwTgaiqk
- USDT (TON): UQA5pGOJhIz9UAVEOh5t2ur1QVbNr_FC1eq9bOb3GwTgaiqk
