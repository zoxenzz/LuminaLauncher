<script setup lang="ts">
import {
	NoSignalIcon,
	PinIcon,
	PlayIcon,
	RocketIcon,
	SignalIcon,
	SpinnerIcon,
	StopCircleIcon,
} from '@modrinth/assets'
import {
	Avatar,
	ButtonStyled,
	defineMessages,
	TagItem,
	useFormatNumber,
	useVIntl,
} from '@modrinth/ui'
import { computed } from 'vue'

import type { ModpackRequirement } from '@/helpers/modpack-detection'
import type { GameInstance } from '@/helpers/types'
import type { ServerStatus, WorldWithProfile } from '@/helpers/worlds'

const { formatMessage } = useVIntl()
const formatNumber = useFormatNumber()

const props = defineProps<{
	world: WorldWithProfile
	instance?: GameInstance
	serverStatus?: ServerStatus
	refreshing: boolean
	requirement: ModpackRequirement
	autoInstall: boolean
	playing: boolean
	supportsQuickPlay: boolean
}>()

const emit = defineEmits<{
	(e: 'play' | 'stop' | 'pin'): void
}>()

const messages = defineMessages({
	pinned: {
		id: 'home.yourServers.pinned',
		defaultMessage: 'Pinned',
	},
	pinServer: {
		id: 'home.yourServers.pin_server',
		defaultMessage: 'Pin server',
	},
	unpinServer: {
		id: 'home.yourServers.unpin_server',
		defaultMessage: 'Unpin server',
	},
	moddedAutoInstall: {
		id: 'home.yourServers.modded_auto_install',
		defaultMessage: 'Modded — Auto-install',
	},
	modded: {
		id: 'home.yourServers.modded',
		defaultMessage: 'Modded',
	},
	vanillaPlus: {
		id: 'home.yourServers.vanilla_plus',
		defaultMessage: 'Vanilla+',
	},
	playersOnline: {
		id: 'home.yourServers.players_online',
		defaultMessage: '{count} / {max} online',
	},
	offline: {
		id: 'home.yourServers.offline',
		defaultMessage: 'Offline',
	},
	loading: {
		id: 'home.yourServers.loading',
		defaultMessage: 'Loading...',
	},
	play: {
		id: 'home.yourServers.play',
		defaultMessage: 'Play',
	},
	stop: {
		id: 'home.yourServers.stop',
		defaultMessage: 'Stop',
	},
	noServerQuickPlay: {
		id: 'home.yourServers.no_server_quick_play',
		defaultMessage: 'You can only jump straight into servers on Minecraft Alpha 1.0.5+',
	},
})

const pinned = computed(() => props.world.world.display_status === 'favorite')
const serverIcon = computed(() => props.serverStatus?.favicon ?? props.world.world.icon)

const tag = computed(() => {
	if (props.autoInstall) {
		return {
			label: formatMessage(messages.moddedAutoInstall),
			icon: RocketIcon,
			branded: true,
		}
	}
	if (props.requirement === 'modpack') {
		return {
			label: formatMessage(messages.modded),
			icon: RocketIcon,
			branded: true,
		}
	}
	return {
		label: formatMessage(messages.vanillaPlus),
		icon: null,
		branded: false,
	}
})
</script>

<template>
	<div class="card-shadow bg-bg-raised rounded-xl p-4 flex flex-col gap-3">
		<div class="flex items-center gap-3">
			<Avatar :src="serverIcon" size="48px" :tint-by="world.world.address" alt="" />
			<div class="min-w-0 flex-1">
				<p class="m-0 truncate font-bold text-contrast leading-tight">{{ world.world.name }}</p>
				<p class="m-0 truncate text-sm text-secondary font-semibold">{{ world.world.address }}</p>
			</div>
			<ButtonStyled circular type="transparent">
				<button
					v-tooltip="
						pinned ? formatMessage(messages.unpinServer) : formatMessage(messages.pinServer)
					"
					:aria-label="
						pinned ? formatMessage(messages.unpinServer) : formatMessage(messages.pinServer)
					"
					@click="emit('pin')"
				>
					<PinIcon :class="pinned ? 'fill-brand text-brand' : 'text-secondary'" />
				</button>
			</ButtonStyled>
		</div>

		<div class="flex items-center gap-1 text-secondary font-semibold text-sm">
			<template v-if="refreshing">
				<SpinnerIcon class="animate-spin shrink-0" aria-hidden="true" />
				{{ formatMessage(messages.loading) }}
			</template>
			<template v-else-if="serverStatus">
				<SignalIcon class="shrink-0 text-green" aria-hidden="true" />
				{{
					formatMessage(messages.playersOnline, {
						count: formatNumber(serverStatus.players?.online ?? 0),
						max: formatNumber(serverStatus.players?.max ?? 0),
					})
				}}
			</template>
			<template v-else>
				<NoSignalIcon class="shrink-0" aria-hidden="true" />
				{{ formatMessage(messages.offline) }}
			</template>
		</div>

		<div class="flex items-center justify-between gap-2">
			<TagItem
				v-if="tag.label"
				class="text-xs"
				:class="
					tag.branded
						? 'border !border-solid border-brand bg-highlight'
						: 'border !border-solid border-secondary bg-bg'
				"
				:style="tag.branded ? '--_color: var(--color-brand)' : '--_color: var(--color-secondary)'"
			>
				<component :is="tag.icon" v-if="tag.icon" aria-hidden="true" class="h-4 w-4" />
				{{ tag.label }}
			</TagItem>
			<ButtonStyled v-if="playing" color="red" circular>
				<button v-tooltip="formatMessage(messages.stop)" @click="emit('stop')">
					<StopCircleIcon aria-hidden="true" />
				</button>
			</ButtonStyled>
			<ButtonStyled v-else :color="pinned ? 'brand' : 'standard'" circular>
				<button
					v-tooltip="
						supportsQuickPlay
							? formatMessage(messages.play)
							: formatMessage(messages.noServerQuickPlay)
					"
					:disabled="!supportsQuickPlay"
					@click="emit('play')"
				>
					<PlayIcon aria-hidden="true" class="translate-x-[1px]" />
				</button>
			</ButtonStyled>
		</div>
	</div>
</template>
