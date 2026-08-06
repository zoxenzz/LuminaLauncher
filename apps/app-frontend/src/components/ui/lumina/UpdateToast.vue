<script setup lang="ts">
import { DownloadIcon, SpinnerIcon, XIcon } from '@modrinth/assets'
import { ProgressBar, defineMessages, useVIntl } from '@modrinth/ui'

import { useUpdater } from '@/store/updater'

const updater = useUpdater()
const { formatMessage } = useVIntl()

const messages = defineMessages({
	checking: {
		id: 'lumina.app.updater.toast.checking',
		defaultMessage: 'Checking for updates…',
	},
	available: {
		id: 'lumina.app.updater.toast.available',
		defaultMessage: 'New version available (v{version})',
	},
	availableText: {
		id: 'lumina.app.updater.toast.available-text',
		defaultMessage: 'A newer Lumina Launcher build is ready to install.',
	},
	updateNow: {
		id: 'lumina.app.updater.toast.update-now',
		defaultMessage: 'Update now',
	},
	downloading: {
		id: 'lumina.app.updater.toast.downloading',
		defaultMessage: 'New update available (v{version}) — downloading…',
	},
	installing: {
		id: 'lumina.app.updater.toast.installing',
		defaultMessage: 'Installing update…',
	},
	readyTitle: {
		id: 'lumina.app.updater.toast.ready.title',
		defaultMessage: 'Update installed',
	},
	readyText: {
		id: 'lumina.app.updater.toast.ready.text',
		defaultMessage: 'Restart Lumina Launcher to apply the update.',
	},
	restartNow: {
		id: 'lumina.app.updater.toast.restart-now',
		defaultMessage: 'Restart now',
	},
	restartingSoon: {
		id: 'lumina.app.updater.toast.restarting-soon',
		defaultMessage: 'Restarting in {seconds}s…',
	},
	later: {
		id: 'lumina.app.updater.toast.later',
		defaultMessage: 'Later',
	},
	errorTitle: {
		id: 'lumina.app.updater.toast.error.title',
		defaultMessage: 'Update check failed',
	},
	close: {
		id: 'lumina.app.updater.toast.close',
		defaultMessage: 'Dismiss',
	},
})
</script>

<template>
	<Transition name="update-toast">
		<div v-if="updater.toastVisible" class="update-toast" role="status" aria-live="polite">
			<button
				class="update-toast-close"
				:aria-label="formatMessage(messages.close)"
				@click="updater.dismissToast()"
			>
				<XIcon class="size-4" />
			</button>

			<!-- 1. Checking for updates -->
			<div v-if="updater.isChecking" class="update-toast-body">
				<SpinnerIcon class="update-toast-icon animate-spin" />
				<p class="update-toast-title m-0">{{ formatMessage(messages.checking) }}</p>
			</div>

			<!-- 2. Update available (manual mode) -->
			<div v-else-if="updater.phase === 'available'" class="update-toast-body">
				<DownloadIcon class="update-toast-icon" />
				<div class="update-toast-text">
					<p class="update-toast-title m-0">
						{{ formatMessage(messages.available, { version: updater.version }) }}
					</p>
					<p class="m-0 text-secondary text-sm">{{ formatMessage(messages.availableText) }}</p>
					<div class="update-toast-actions">
						<button
							class="update-toast-primary"
							:disabled="updater.isUpdateInstalling"
							@click="updater.updateNow()"
						>
							{{ formatMessage(messages.updateNow) }}
						</button>
						<button class="update-toast-ghost" @click="updater.dismissToast()">
							{{ formatMessage(messages.later) }}
						</button>
					</div>
				</div>
			</div>

			<!-- 3. Downloading with progress -->
			<div v-else-if="updater.phase === 'downloading'" class="update-toast-body">
				<DownloadIcon class="update-toast-icon" />
				<div class="update-toast-text">
					<p class="update-toast-title m-0">
						{{ formatMessage(messages.downloading, { version: updater.version }) }}
					</p>
					<div class="update-toast-progress">
						<ProgressBar :progress="updater.progress" class="flex-1" />
						<span class="update-toast-percent">{{ updater.downloadPercent }}%</span>
					</div>
				</div>
			</div>

			<!-- 4. Installing -->
			<div v-else-if="updater.isUpdateInstalling" class="update-toast-body">
				<SpinnerIcon class="update-toast-icon animate-spin" />
				<p class="update-toast-title m-0">{{ formatMessage(messages.installing) }}</p>
			</div>

			<!-- 5. Installed — restart to apply -->
			<div v-else-if="updater.isReadyToRestart" class="update-toast-body">
				<span class="update-toast-check" aria-hidden="true">
					<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12" />
					</svg>
				</span>
				<div class="update-toast-text">
					<p class="update-toast-title m-0">{{ formatMessage(messages.readyTitle) }}</p>
					<p class="m-0 text-secondary text-sm">{{ formatMessage(messages.readyText) }}</p>
					<p v-if="updater.autoRestart && updater.restartInSeconds > 0" class="update-toast-countdown m-0">
						{{ formatMessage(messages.restartingSoon, { seconds: updater.restartInSeconds }) }}
					</p>
					<div class="update-toast-actions">
						<button class="update-toast-primary" @click="updater.restartToApply()">
							{{ formatMessage(messages.restartNow) }}
						</button>
						<button class="update-toast-ghost" @click="updater.dismissToast()">
							{{ formatMessage(messages.later) }}
						</button>
					</div>
				</div>
			</div>

			<!-- 6. Error (dismissible, non-blocking) -->
			<div v-else-if="updater.hasError" class="update-toast-body">
				<span class="update-toast-error" aria-hidden="true">!</span>
				<p class="update-toast-title m-0">{{ formatMessage(messages.errorTitle) }}</p>
			</div>
		</div>
	</Transition>
</template>

<style lang="scss" scoped>
@import '../../../../../../packages/assets/styles/lumina/neon-button.scss';

.update-toast {
	position: fixed;
	top: calc(var(--top-bar-height, 3rem) + 0.75rem);
	right: 0.75rem;
	z-index: 100;

	width: 340px;
	max-width: calc(100vw - 1.5rem);
	padding: 0.875rem 2.5rem 0.875rem 1rem;

	background: rgba(16, 14, 12, 0.92);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.875rem;
	box-shadow:
		0 20px 48px rgba(0, 0, 0, 0.45),
		0 4px 12px rgba(0, 0, 0, 0.28);
	backdrop-filter: blur(24px) saturate(175%);
	-webkit-backdrop-filter: blur(24px) saturate(175%);
}

.update-toast-close {
	position: absolute;
	top: 0.5rem;
	right: 0.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.75rem;
	height: 1.75rem;
	padding: 0;
	border: none;
	border-radius: 0.5rem;
	background: transparent;
	color: var(--color-secondary);
	cursor: pointer;
	transition:
		color 0.15s ease,
		background 0.15s ease;

	&:hover {
		color: var(--color-contrast);
		background: rgba(255, 255, 255, 0.08);
	}
}

.update-toast-body {
	display: flex;
	align-items: flex-start;
	gap: 0.75rem;
}

.update-toast-icon {
	width: 1.5rem;
	height: 1.5rem;
	flex-shrink: 0;
	margin-top: 0.125rem;
	color: var(--color-brand);
}

.update-toast-check {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.5rem;
	height: 1.5rem;
	flex-shrink: 0;
	margin-top: 0.125rem;
	border-radius: 999px;
	background: color-mix(in srgb, var(--color-brand) 22%, transparent);
	color: var(--color-brand);
}

.update-toast-error {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.5rem;
	height: 1.5rem;
	flex-shrink: 0;
	margin-top: 0.125rem;
	border-radius: 999px;
	background: color-mix(in srgb, #f44336 20%, transparent);
	color: #f44336;
	font-weight: 800;
}

.update-toast-text {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
	min-width: 0;
}

.update-toast-title {
	font-weight: 600;
	color: var(--color-contrast);
}

.update-toast-progress {
	display: flex;
	align-items: center;
	gap: 0.625rem;
	margin-top: 0.375rem;
}

.update-toast-percent {
	flex-shrink: 0;
	font-size: 0.75rem;
	color: var(--color-brand);
	font-variant-numeric: tabular-nums;
}

.update-toast-countdown {
	font-size: 0.75rem;
	color: var(--color-brand);
}

.update-toast-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-top: 0.5rem;

	.update-toast-primary {
		padding: 0.375rem 0.875rem;
		border: 1px solid #3e8cde;
		border-radius: 0.625rem;
		background: transparent;
		color: #3e8cde;
		font-weight: 600;
		cursor: pointer;
		transition:
			color 0.2s ease,
			border-color 0.2s ease,
			box-shadow 0.2s ease;

		&:hover:not([disabled]) {
			color: #10fae5;
			border-color: #10fae5;
			box-shadow: 0 0 8px rgba(16, 250, 229, 0.25);
		}

		&[disabled] {
			opacity: 0.5;
			cursor: default;
		}
	}

	.update-toast-ghost {
		padding: 0.375rem 0.75rem;
		border: none;
		border-radius: 0.625rem;
		background: transparent;
		color: var(--color-secondary);
		cursor: pointer;
		transition:
			color 0.15s ease,
			background 0.15s ease;

		&:hover {
			color: var(--color-contrast);
			background: rgba(255, 255, 255, 0.06);
		}
	}
}

/* Entrance/exit animation */
.update-toast-enter-active,
.update-toast-leave-active {
	transition:
		opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
		transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.update-toast-enter-from,
.update-toast-leave-to {
	opacity: 0;
	transform: translateY(-8px) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
	.update-toast-enter-active,
	.update-toast-leave-active {
		transition: none;
	}
}
</style>
