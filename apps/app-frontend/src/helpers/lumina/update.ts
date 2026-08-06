import { getVersion } from '@tauri-apps/api/app'
import { ref } from 'vue'

import { getOS, initUpdateLauncher, isDev } from '@/helpers/utils.js'
import { get } from '@/helpers/settings.ts'

export type LauncherReleaseAsset = {
	name: string
	browser_download_url: string
}

export type LauncherRelease = {
	tag_name: string
	name: string
	assets: LauncherReleaseAsset[]
}

export const LAUNCHER_REPOSITORY_URL = `${import.meta.env.GITHUB_URL}zoxenzz/LuminaLauncher/`
export const LAUNCHER_RELEASES_URL = `${LAUNCHER_REPOSITORY_URL}releases`
const LAUNCHER_LATEST_RELEASE_API = `${import.meta.env.GITHUB_API_URL}repos/zoxenzz/LuminaLauncher/releases/latest`

// Optional fine-grained PAT (Contents: Read, scoped to zoxenzz/LuminaLauncher only)
// used to authenticate against the PRIVATE update repo. Bake it in via the
// GITHUB_TOKEN env var (see packages/app-lib/.env and the CI workflow).
const GITHUB_TOKEN: string | undefined = import.meta.env.GITHUB_TOKEN

export const isUpdateInstalling = ref(false)
export const isUpdateAvailable = ref(false)
export const isAutoUpdating = ref(false)
export const latestLauncherRelease = ref<LauncherRelease | null>(null)

const currentOS = ref('')

const systems = ['macos', 'windows', 'linux'] as const
const osExtensions = {
	"linux": ['.deb'],
	"macos": ['.dmg', '.pkg', '.app'],
	"windows": ['.exe', '.msi']
}

const isDeveloper = await isDev()

const blacklistBeginPrefixes = [
	'dev',
	'nightly',
	'dirty',
	'dirty-dev',
	'dirty-nightly',
	'dirty_dev',
	'dirty_nightly',
]

export async function fetchRemote(): Promise<void> {
	currentOS.value = (await getOS()).toLowerCase()

	try {
		const response = await fetch(LAUNCHER_LATEST_RELEASE_API, {
			headers: GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : undefined,
		})
		if (!response.ok) {
			throw new Error(String(response.status))
		}

		const remoteData = (await response.json()) as LauncherRelease
		latestLauncherRelease.value = remoteData

		if (systems.includes(currentOS.value as (typeof systems)[number])) {
			const rawLocalVersion = await getVersion()
			const localVersion = normalizeVersion(rawLocalVersion)
			const remoteVersion = normalizeVersion(remoteData.tag_name)
			const versionComparison = compareVersions(remoteVersion, localVersion)
			isUpdateAvailable.value = versionComparison > 0

			if (isDeveloper) {
				console.debug('Raw local version is', rawLocalVersion)
				console.debug('Normalized local version is', localVersion)
				console.debug('Raw remote version is', remoteData.tag_name)
				console.debug('Normalized remote version is', remoteVersion)
				console.debug('Version comparison result is', versionComparison)
			}

			if (isUpdateAvailable.value) {
				const settings = await get()
				if (settings.auto_download_updates) {
					await performAutoUpdate()
				}
			}
		} else {
			isUpdateAvailable.value = false

			if (isDeveloper) {
				console.debug('Skipped update comparison for unsupported OS', currentOS.value)
			}
		}

		if (isDeveloper) {
			console.debug('Update available state is', isUpdateAvailable.value)
			console.debug('Remote version is', remoteData.tag_name)
			console.debug('Remote title is', remoteData.name)
			console.debug('Operating System is', currentOS.value)
		}
	} catch (error) {
		console.error('Failed to fetch remote releases:', error)
		latestLauncherRelease.value = null
		isUpdateAvailable.value = false
		isUpdateInstalling.value = false
		isAutoUpdating.value = false
	}
}

async function performAutoUpdate() {
	if (isUpdateInstalling.value || isAutoUpdating.value) {
		return
	}

	const settings = await get()
	if (!settings.auto_download_updates) {
		return
	}

	isAutoUpdating.value = true
	const result = await downloadLatestRelease()
	if (!result) {
		console.error('Auto-update failed')
	}
	isAutoUpdating.value = false
}

export async function downloadLatestRelease(): Promise<boolean> {
	if (!latestLauncherRelease.value) {
		return false
	}

	if (!currentOS.value) {
		currentOS.value = (await getOS()).toLowerCase()
	}

	const installer = getInstaller(resolveOperationalSystemExtension(), latestLauncherRelease.value.assets)
	if (isDeveloper) {
		console.debug(installer)
	}
	if (!installer) {
		isUpdateInstalling.value = false
		return false
	}

	try {
		isUpdateInstalling.value = true
		return await initUpdateLauncher(
			installer.browser_download_url,
			installer.name,
			currentOS.value,
			true,
			GITHUB_TOKEN,
		)
	} finally {
		isUpdateInstalling.value = false
	}
}

function getInstaller(
	osExtensions: string[],
	builds: LauncherReleaseAsset[],
): LauncherReleaseAsset | null {
	for (const build of builds) {
		if (blacklistBeginPrefixes.some((prefix) => build.name.startsWith(prefix))) {
			continue
		}

		if (osExtensions.some((extension) => build.name.endsWith(extension))) {
			if (isDeveloper) {
				console.debug(build.name, build.browser_download_url)
			}
			return build
		}
	}

	return null
}

function resolveOperationalSystemExtension(): string[] {
	if (currentOS.value === 'macos') {
		return osExtensions["macos"]
	}

	if (currentOS.value === 'linux') {
		return osExtensions["linux"]
	}

	return osExtensions["windows"]
}

function normalizeVersion(version: string): string {
	return version.trim().replace(/^v/i, '')
}

function compareVersions(left: string, right: string): number {
	const leftParts = parseVersionParts(left)
	const rightParts = parseVersionParts(right)
	const maxLength = Math.max(leftParts.length, rightParts.length)

	for (let index = 0; index < maxLength; index += 1) {
		const leftPart = leftParts[index] ?? 0
		const rightPart = rightParts[index] ?? 0

		if (leftPart !== rightPart) {
			if (isDeveloper) {
				console.debug('Version parts differ at index', index, leftPart, rightPart)
			}
			return leftPart - rightPart
		}
	}

	if (isDeveloper) {
		console.debug('Version parts are equal', leftParts, rightParts)
	}

	return 0
}

function parseVersionParts(version: string): number[] {
	return normalizeVersion(version)
		.split(/[.-]/)
		.map((part) => Number.parseInt(part, 10))
		.filter((part) => !Number.isNaN(part))
}
