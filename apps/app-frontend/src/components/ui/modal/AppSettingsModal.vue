<script setup lang="ts">
import {
	CoffeeIcon,
	DownloadIcon,
	GameIcon,
	GaugeIcon,
	LanguagesIcon,
	LuminaLauncherLogo,
	PaintbrushIcon,
	RefreshCwIcon,
	RotateClockwiseIcon,
	SettingsIcon,
	ShieldIcon,
	SpinnerIcon,
	ToggleRightIcon,
} from '@modrinth/assets'
import {
	commonMessages,
	commonSettingsMessages,
	defineMessage,
	defineMessages,
	ProgressBar,
	TabbedModal,
	useVIntl,
} from '@modrinth/ui'
import { getVersion } from '@tauri-apps/api/app'
import { platform as getOsPlatform, version as getOsVersion } from '@tauri-apps/plugin-os'
import { computed, ref, watch } from 'vue'

import LauncherUpdateModal from '@/components/ui/lumina/LauncherUpdateModal.vue'
import AppearanceSettings from '@/components/ui/settings/AppearanceSettings.vue'
import DefaultInstanceSettings from '@/components/ui/settings/DefaultInstanceSettings.vue'
import FeatureFlagSettings from '@/components/ui/settings/FeatureFlagSettings.vue'
import JavaSettings from '@/components/ui/settings/JavaSettings.vue'
import LanguageSettings from '@/components/ui/settings/LanguageSettings.vue'
import PrivacySettings from '@/components/ui/settings/PrivacySettings.vue'
import ResourceManagementSettings from '@/components/ui/settings/ResourceManagementSettings.vue'
import { get, set } from '@/helpers/settings.ts'
import { injectAppUpdateDownloadProgress } from '@/providers/download-progress.ts'
import { useTheming } from '@/store/state'
import { useUpdater } from '@/store/updater'

const themeStore = useTheming()
const updater = useUpdater()
const { formatMessage } = useVIntl()

const devModeCounter = ref(0)
const modal = ref<InstanceType<typeof TabbedModal> | null>(null)
const launcherUpdateModal = ref<InstanceType<typeof LauncherUpdateModal> | null>(null)

const developerModeEnabled = defineMessage({
	id: 'app.settings.developer-mode-enabled',
	defaultMessage: 'Developer mode enabled.',
})

const tabs = [
	{
		name: defineMessage({
			id: 'app.settings.tabs.appearance',
			defaultMessage: 'Appearance',
		}),
		icon: PaintbrushIcon,
		content: AppearanceSettings,
	},
	{
		name: defineMessage({
			id: 'app.settings.tabs.language',
			defaultMessage: 'Language',
		}),
		icon: LanguagesIcon,
		content: LanguageSettings,
		badge: commonMessages.beta,
	},
	{
		name: defineMessage({
			id: 'app.settings.tabs.privacy',
			defaultMessage: 'Privacy',
		}),
		icon: ShieldIcon,
		content: PrivacySettings,
	},
	{
		name: defineMessage({
			id: 'app.settings.tabs.java-installations',
			defaultMessage: 'Java installations',
		}),
		icon: CoffeeIcon,
		content: JavaSettings,
	},
	{
		name: defineMessage({
			id: 'app.settings.tabs.default-instance-options',
			defaultMessage: 'Default instance options',
		}),
		icon: GameIcon,
		content: DefaultInstanceSettings,
	},
	{
		name: defineMessage({
			id: 'app.settings.tabs.resource-management',
			defaultMessage: 'Resource management',
		}),
		icon: GaugeIcon,
		content: ResourceManagementSettings,
	},
	{
		name: commonSettingsMessages.featureFlags,
		icon: ToggleRightIcon,
		content: FeatureFlagSettings,
		developerOnly: true,
	},
]

function show() {
	modal.value?.show()
}

function showUpdateModal() {
	modal.value?.show()
	void launcherUpdateModal.value?.show()
}

defineExpose({ show, showUpdateModal }) // Kept for its side effect: App.vue provides this so the modal can render;
// the footer itself drives off the updater store's live progress.
injectAppUpdateDownloadProgress()

const version = await getVersion()
const osPlatform = getOsPlatform()
const osVersion = getOsVersion()
const settings = ref(await get())

// Prefer the latest GitHub release tag (fetched at startup by the updater) so
// the footer always reflects the newest published build; fall back to the
// local build version if the remote isn't available yet (e.g. offline).
const displayedVersion = computed(() => updater.latestLauncherRelease.value?.tag_name ?? version)

watch(
	settings,
	async () => {
		await set(settings.value)
	},
	{ deep: true },
)

function devModeCount() {
	devModeCounter.value++
	if (devModeCounter.value > 5) {
		themeStore.devMode = !themeStore.devMode
		settings.value.developer_mode = !!themeStore.devMode
		devModeCounter.value = 0

		if (!themeStore.devMode && tabs[modal.value!.selectedTab].developerOnly) {
			modal.value!.setTab(0)
		}
	}
}
const messages = defineMessages({
	downloading: {
		id: 'app.settings.downloading',
		defaultMessage: 'Downloading v{version}',
	},
	updateInstalling: {
		id: 'lumina.app.settings.update-installing',
		defaultMessage: 'Installing update...',
	},
	checkForUpdates: {
		id: 'lumina.app.settings.check-for-updates',
		defaultMessage: 'Check for updates',
	},
	checkingForUpdates: {
		id: 'lumina.app.settings.checking-for-updates',
		defaultMessage: 'Checking…',
	},
	updateAvailable: {
		id: 'lumina.app.settings.update-available',
		defaultMessage: 'Update available',
	},
	restartToApply: {
		id: 'lumina.app.settings.restart-to-apply',
		defaultMessage: 'Restart to apply',
	},
})
</script>

<template>
	<TabbedModal ref="modal" :tabs="tabs.filter((t) => !t.developerOnly || themeStore.devMode)">
		<template #title>
			<span class="flex items-center gap-2 text-lg font-extrabold text-contrast">
				<SettingsIcon /> Settings
			</span>
		</template>
		<template #footer>
			<div class="settings-footer">
				<div v-if="updater.phase === 'downloading'" class="settings-footer-progress">
					<p class="settings-footer-downloading m-0 mb-2">
						{{ formatMessage(messages.downloading, { version: updater.version }) }}
					</p>
					<ProgressBar :progress="updater.progress" />
				</div>

				<p v-if="themeStore.devMode" class="text-brand font-semibold m-0">
					{{ formatMessage(developerModeEnabled) }}
				</p>

				<div class="settings-footer-brand">
					<button
						type="button"
						class="settings-footer-logo"
						:aria-label="`Lumina Launcher v${displayedVersion}`"
						@click="devModeCount"
					>
						<LuminaLauncherLogo class="size-5" />
					</button>
					<div class="min-w-0">
						<p class="settings-footer-name m-0">Lumina Launcher</p>
						<p class="m-0 text-xs">
							<span class="settings-footer-version">v{{ displayedVersion }}</span>
							<span class="text-secondary">
								· <span v-if="osPlatform === 'macos'">macOS</span>
								<span v-else class="capitalize">{{ osPlatform }}</span>
								{{ osVersion }}
							</span>
						</p>
					</div>
				</div>

				<button
					v-if="!updater.isUpdateAvailable"
					type="button"
					class="settings-footer-action"
					:disabled="updater.isChecking"
					@click="updater.checkForUpdates()"
				>
					<SpinnerIcon v-if="updater.isChecking" class="size-4 animate-spin" />
					<RefreshCwIcon v-else class="size-4" />
					{{
						formatMessage(
							updater.isChecking ? messages.checkingForUpdates : messages.checkForUpdates,
						)
					}}
				</button>

				<button
					v-else-if="updater.isReadyToRestart"
					type="button"
					class="settings-footer-action settings-footer-action-update settings-update-pulse"
					@click="updater.restartToApply()"
				>
					<RotateClockwiseIcon class="size-4" />
					{{ formatMessage(messages.restartToApply) }}
				</button>

				<button
					v-else-if="updater.isUpdateInstalling"
					type="button"
					class="settings-footer-action settings-footer-action-update"
					disabled
				>
					<SpinnerIcon class="size-4 animate-spin" />
					{{ formatMessage(messages.updateInstalling) }}
				</button>

				<button
					v-else-if="updater.phase === 'available'"
					type="button"
					class="settings-footer-action settings-footer-action-update settings-update-pulse"
					@click="showUpdateModal()"
				>
					<DownloadIcon class="size-4" />
					{{ formatMessage(messages.updateAvailable) }}
				</button>
				<!-- phase === 'downloading' renders no action button; the progress
				     card above already communicates that state -->
			</div>
		</template>
	</TabbedModal>

	<LauncherUpdateModal ref="launcherUpdateModal" :version="version" />
</template>
<style lang="scss" scoped>
.settings-footer {
	display: flex;
	flex-direction: column;
	gap: 0.625rem;
	margin-top: auto;
	padding-top: 0.75rem;
	border-top: 1px solid var(--brand-gradient-border);
}

.settings-footer-progress {
	padding: 0.625rem;
	border-radius: 0.875rem;
	border: 1px solid color-mix(in srgb, var(--color-brand) 18%, transparent);
	background: color-mix(in srgb, var(--color-brand) 4%, transparent);
}

.settings-footer-downloading {
	color: var(--color-brand);
	font-size: 0.8rem;
	font-weight: 600;
}

.settings-footer-brand {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	padding: 0.625rem;
	border-radius: 0.875rem;
	border: 1px solid color-mix(in srgb, var(--color-brand) 20%, transparent);
	background:
		linear-gradient(180deg, color-mix(in srgb, var(--color-brand) 9%, transparent), transparent),
		rgba(255, 255, 255, 0.02);
}

.settings-footer-logo {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2.25rem;
	height: 2.25rem;
	flex-shrink: 0;
	padding: 0;
	border-radius: 0.75rem;
	border: 1px solid color-mix(in srgb, var(--color-brand) 28%, transparent);
	background: color-mix(in srgb, var(--color-brand) 12%, transparent);
	color: var(--color-brand);
	cursor: pointer;
	transition:
		transform 0.15s ease,
		filter 0.15s ease,
		border-color 0.15s ease;

	&:hover {
		transform: scale(1.06);
		filter: brightness(1.2);
		border-color: color-mix(in srgb, var(--color-brand) 50%, transparent);
	}

	&:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--color-brand) 75%, transparent);
		outline-offset: 2px;
	}
}

.settings-footer-name {
	color: var(--color-contrast);
	font-size: 0.875rem;
	font-weight: 700;
	line-height: 1.2;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.settings-footer-version {
	color: var(--color-brand);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
}
.settings-footer-action {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	width: 100%;
	padding: 0.5rem 0.75rem;
	border-radius: 0.75rem;
	border: 1px solid color-mix(in srgb, var(--color-brand) 40%, transparent);
	background: color-mix(in srgb, var(--color-brand) 6%, transparent);
	color: var(--color-brand);
	font: inherit;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition:
		background-color 0.2s ease,
		border-color 0.2s ease,
		transform 0.15s ease,
		box-shadow 0.2s ease;

	&:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--color-brand) 75%, transparent);
		outline-offset: 2px;
	}

	&:hover:not([disabled]) {
		background: color-mix(in srgb, var(--color-brand) 13%, transparent);
		border-color: color-mix(in srgb, var(--color-brand) 70%, transparent);
		transform: translateY(-1px);
		box-shadow:
			0 6px 18px rgba(0, 0, 0, 0.3),
			0 0 14px color-mix(in srgb, var(--color-brand) 14%, transparent);
	}

	&:active:not([disabled]) {
		transform: translateY(0);
	}

	&[disabled] {
		opacity: 0.65;
		cursor: default;
	}
}

.settings-footer-action-update {
	border-color: color-mix(in srgb, var(--color-brand) 55%, transparent);
	background: linear-gradient(
		180deg,
		color-mix(in srgb, var(--color-brand) 20%, transparent),
		color-mix(in srgb, var(--color-brand) 7%, transparent)
	);
	font-weight: 700;

	&:hover:not([disabled]) {
		filter: brightness(1.1);
		box-shadow: 0 0 16px color-mix(in srgb, var(--color-brand) 22%, transparent);
	}
}

@media (prefers-reduced-motion: no-preference) {
	.settings-update-pulse {
		animation: settings-pulse-breathe 2.5s ease-in-out infinite;
	}

	@keyframes settings-pulse-breathe {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}
}
</style>
