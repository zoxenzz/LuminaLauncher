import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { arch } from '@tauri-apps/plugin-os'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getOS } from '@/helpers/utils.js'
import { get as getSettings } from '@/helpers/settings.ts'

export type LauncherUpdatePhase =
	| 'idle'
	| 'checking'
	| 'up_to_date'
	| 'available'
	| 'downloading'
	| 'installing'
	| 'ready_to_restart'
	| 'error'

/** A release asset, matching the shape returned by the Rust updater. */
export interface LauncherReleaseAsset {
	id: number
	name: string
	/** API asset URL — used (instead of browser_download_url) for private repos. */
	url: string
	browserDownloadUrl: string
	contentType?: string | null
	size?: number | null
}

export interface LauncherRelease {
	tag_name: string
	name?: string | null
	body?: string | null
	assets: LauncherReleaseAsset[]
}

/** Serialized `update://status` payloads emitted by the Rust updater. */
export type UpdateStatusPayload =
	| { type: 'checking' }
	| { type: 'up_to_date' }
	| { type: 'update_available'; version: string; notes?: string | null; size?: number | null }
	| { type: 'downloading'; version: string }
	| { type: 'installing'; version: string }
	| { type: 'ready_to_restart'; version: string; auto_restart: boolean }
	| { type: 'error'; message: string }

/** Serialized `update://progress` payloads emitted by the Rust updater. */
export interface UpdateProgressPayload {
	downloaded: number
	total?: number | null
}

export interface UpdateCheckResult {
	status: UpdateStatusPayload
	release?: LauncherRelease | null
}

export const LAUNCHER_REPOSITORY_URL = `${import.meta.env.GITHUB_URL}zoxenzz/LuminaLauncher/`
export const LAUNCHER_RELEASES_URL = `${LAUNCHER_REPOSITORY_URL}releases`

const AUTO_RESTART_DELAY_MS = 15_000

/** Pre-release build names that must never be offered as updates. */
const BLACKLIST_PREFIXES = [
	'dev',
	'nightly',
	'dirty',
	'dirty-dev',
	'dirty-nightly',
	'dirty_dev',
	'dirty_nightly',
]

const OS_EXTENSIONS: Record<string, string[]> = {
	linux: ['.deb', '.AppImage'],
	macos: ['.dmg', '.pkg', '.app'],
	windows: ['.exe', '.msi'],
}

/**
 * Matches the architecture tokens used in this project's release asset names
 * (`x64`/`x86_64`/`amd64` for Intel/AMD, `arm64`/`aarch64` for ARM — the macOS
 * arm64 DMGs are named `..._aarch64.dmg`).
 */
function matchesArch(name: string, wantArm: boolean): boolean {
	if (wantArm) return name.includes('arm64') || name.includes('aarch64')
	return name.includes('x64') || name.includes('x86_64') || name.includes('amd64')
}

/**
 * Chooses the installer matching the current OS and CPU architecture,
 * preferring arch-specific builds over generic ones.
 */
async function selectInstaller(
	builds: LauncherReleaseAsset[],
): Promise<LauncherReleaseAsset | null> {
	const currentOS = (await getOS()).toLowerCase()
	const extensions = OS_EXTENSIONS[currentOS] ?? []
	const wantArm = (await arch()).includes('arm')

	const candidates = builds.filter(
		(build) =>
			!BLACKLIST_PREFIXES.some((prefix) => build.name.startsWith(prefix)) &&
			extensions.some((extension) => build.name.endsWith(extension)),
	)

	return candidates.find((build) => matchesArch(build.name, wantArm)) ?? candidates[0] ?? null
}

/**
 * Pinia store for the Lumina Launcher auto-updater.
 *
 * Subscribes to the Rust-emitted `update://status` / `update://progress`
 * events and drives the small non-blocking toast UI (see UpdateToast.vue).
 * The startup check runs in the background; when `auto_download_updates` is
 * enabled (default settings) the download + install happen with no user
 * interaction, otherwise only the "New version available" prompt is shown.
 */
export const useUpdater = defineStore('updater', () => {
	const phase = ref<LauncherUpdatePhase>('idle')
	const release = ref<LauncherRelease | null>(null)
	const version = ref('')
	const errorMessage = ref('')
	const downloadedPath = ref('')

	const progress = ref(0)
	const downloadedBytes = ref(0)
	const totalBytes = ref<number | null>(null)

	const autoRestart = ref(false)
	const restartInSeconds = ref(0)
	const toastDismissed = ref(false)

	let restartTimer: ReturnType<typeof setTimeout> | null = null
	let restartInterval: ReturnType<typeof setInterval> | null = null
	let unlistenStatus: (() => void) | null = null
	let unlistenProgress: (() => void) | null = null
	let downloadInFlight = false

	// -- derived state ------------------------------------------------------

	const isChecking = computed(() => phase.value === 'checking')
	const isUpToDate = computed(() => phase.value === 'up_to_date')
	const isUpdateAvailable = computed(() =>
		['available', 'downloading', 'installing', 'ready_to_restart'].includes(phase.value),
	)
	const isUpdateInstalling = computed(() => phase.value === 'installing')
	const isAutoUpdating = computed(
		() => phase.value === 'downloading' || phase.value === 'installing',
	)
	const isReadyToRestart = computed(() => phase.value === 'ready_to_restart')
	const hasError = computed(() => phase.value === 'error')
	const latestLauncherRelease = computed(() => release.value)
	const downloadPercent = computed(() =>
		Math.min(100, Math.max(0, Math.round(progress.value * 100))),
	)
	const toastVisible = computed(
		() => !toastDismissed.value && (isChecking.value || isUpdateAvailable.value || hasError.value),
	)

	// -- internals ----------------------------------------------------------

	function clearRestartTimers() {
		if (restartTimer) {
			clearTimeout(restartTimer)
			restartTimer = null
		}
		if (restartInterval) {
			clearInterval(restartInterval)
			restartInterval = null
		}
		restartInSeconds.value = 0
	}

	function scheduleAutoRestart() {
		clearRestartTimers()
		if (!autoRestart.value) return

		restartInSeconds.value = AUTO_RESTART_DELAY_MS / 1000
		restartInterval = setInterval(() => {
			restartInSeconds.value -= 1
			if (restartInSeconds.value <= 0 && restartInterval) {
				clearInterval(restartInterval)
				restartInterval = null
				void restartToApply()
			}
		}, 1000)
		restartTimer = setTimeout(() => {
			void restartToApply()
		}, AUTO_RESTART_DELAY_MS)
	}

	function setStatus(status: UpdateStatusPayload) {
		switch (status.type) {
			case 'checking':
				// Ignore a stale "checking" event once the pipeline has moved on.
				if (phase.value !== 'idle' && phase.value !== 'up_to_date') return
				phase.value = 'checking'
				break
			case 'up_to_date':
				phase.value = 'up_to_date'
				toastDismissed.value = false
				break
			case 'update_available':
				// The invoke result may resolve before the status event arrives;
				// never let a late "update_available" clobber an in-progress flow.
				if (isUpdateAvailable.value) return
				phase.value = 'available'
				version.value = status.version
				toastDismissed.value = false
				break
			case 'downloading':
				if (['installing', 'ready_to_restart'].includes(phase.value)) return
				phase.value = 'downloading'
				version.value = status.version
				toastDismissed.value = false
				break
			case 'installing':
				if (phase.value === 'ready_to_restart') return
				phase.value = 'installing'
				toastDismissed.value = false
				break
			case 'ready_to_restart':
				phase.value = 'ready_to_restart'
				autoRestart.value = status.auto_restart
				toastDismissed.value = false
				scheduleAutoRestart()
				break
			case 'error':
				phase.value = 'error'
				errorMessage.value = status.message
				toastDismissed.value = false
				break
		}
	}

	function setProgress(payload: UpdateProgressPayload) {
		downloadedBytes.value = payload.downloaded
		totalBytes.value = payload.total ?? null
		progress.value = payload.total && payload.total > 0 ? payload.downloaded / payload.total : 0
	}

	// -- actions ------------------------------------------------------------

	/** Runs the startup update check (background — never blocks the app). */
	async function checkForUpdates() {
		// Never clobber an in-flight download/install with a re-check.
		if (isAutoUpdating.value || phase.value === 'checking') return
		phase.value = 'checking'
		toastDismissed.value = false
		try {
			const result = await invoke<UpdateCheckResult>('updater_check')
			if (result?.release) release.value = result.release
			if (result?.status) setStatus(result.status)
			if (result?.status?.type === 'update_available') {
				await maybeAutoDownload()
			}
		} catch (error) {
			phase.value = 'error'
			errorMessage.value = String(error)
			console.error('[updater] Update check failed:', error)
		}
	}

	/**
	 * Auto-downloads and installs the newest release when the user enabled
	 * `auto_download_updates` in settings. No-op otherwise.
	 */
	async function maybeAutoDownload() {
		if (phase.value !== 'available') return
		try {
			const settings = await getSettings()
			if (settings.auto_download_updates) {
				const downloaded = await downloadUpdate()
				if (downloaded) await installUpdate()
			}
		} catch (error) {
			console.warn('[updater] Failed to read settings for auto-download:', error)
		}
	}

	/** Downloads the installer for this platform. Returns whether it succeeded. */
	async function downloadUpdate(): Promise<boolean> {
		if (downloadInFlight) return false
		downloadInFlight = true

		try {
			if (!release.value) return false

			const asset = await selectInstaller(release.value.assets)
			if (!asset) {
				phase.value = 'error'
				errorMessage.value = 'No matching installer found for this platform.'
				console.error('[updater] No matching installer found for this platform.', release.value)
				return false
			}

			// If the release ships a `.sha256` sibling asset, verify the download.
			const sha256Asset = release.value.assets.find((a) => a.name === `${asset.name}.sha256`)

			try {
				const path = await invoke<string>('updater_download', {
					asset,
					version: version.value || release.value.tag_name,
					sha256Url: sha256Asset?.url ?? null,
				})
				downloadedPath.value = path
				return true
			} catch (error) {
				phase.value = 'error'
				errorMessage.value = String(error)
				console.error('[updater] Download failed:', error)
				return false
			}
		} finally {
			downloadInFlight = false
		}
	}

	/** Installs the previously downloaded installer (may quit/restart the app). */
	async function installUpdate(): Promise<boolean> {
		if (!downloadedPath.value) return false
		try {
			await invoke('updater_install', { path: downloadedPath.value, version: version.value })
			return true
		} catch (error) {
			phase.value = 'error'
			errorMessage.value = String(error)
			console.error('[updater] Install failed:', error)
			return false
		}
	}

	/** Downloads and installs the update in one go (manual “Update now” flow). */
	async function updateNow(): Promise<boolean> {
		const downloaded = await downloadUpdate()
		if (!downloaded) return false
		return await installUpdate()
	}

	/** Restarts the app to apply an installed update. */
	async function restartToApply() {
		clearRestartTimers()
		try {
			await invoke('restart_app')
		} catch (error) {
			console.error('[updater] Restart failed:', error)
		}
	}

	/** Dismisses the toast (used by the error/ready states). */
	function dismissToast() {
		toastDismissed.value = true
		clearRestartTimers()
	}

	/**
	 * Subscribes to the updater events and kicks off the startup check.
	 * Called once from the root layout on mount.
	 */
	async function init() {
		if (unlistenStatus || unlistenProgress) return

		// Browser preview without the Tauri bridge — events never fire, so a
		// failure here must not prevent the startup check from running.
		if (!unlistenStatus) {
			try {
				unlistenStatus = await listen<UpdateStatusPayload>('update://status', (event) =>
					setStatus(event.payload),
				)
			} catch (error) {
				console.warn('[updater] Could not subscribe to update://status:', error)
			}
		}
		if (!unlistenProgress) {
			try {
				unlistenProgress = await listen<UpdateProgressPayload>('update://progress', (event) =>
					setProgress(event.payload),
				)
			} catch (error) {
				console.warn('[updater] Could not subscribe to update://progress:', error)
			}
		}

		await checkForUpdates()
	}

	return {
		// state
		phase,
		release,
		version,
		errorMessage,
		downloadedPath,
		progress,
		downloadedBytes,
		totalBytes,
		autoRestart,
		restartInSeconds,
		toastDismissed,
		// derived
		isChecking,
		isUpToDate,
		isUpdateAvailable,
		isUpdateInstalling,
		isAutoUpdating,
		isReadyToRestart,
		hasError,
		latestLauncherRelease,
		downloadPercent,
		toastVisible,
		// actions
		init,
		checkForUpdates,
		downloadUpdate,
		installUpdate,
		updateNow,
		restartToApply,
		dismissToast,
	}
})
