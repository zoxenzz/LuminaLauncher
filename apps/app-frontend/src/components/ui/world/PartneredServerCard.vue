<script setup lang="ts">
import { BadgeCheckIcon, GlobeIcon, NoSignalIcon, SpinnerIcon, UsersIcon } from '@modrinth/assets'
import {
	Avatar,
	ButtonStyled,
	defineMessages,
	TagItem,
	useFormatNumber,
	useVIntl,
} from '@modrinth/ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useRouter } from 'vue-router'

import type { PartneredServer } from '@/helpers/partnered-servers'
import type { ServerStatus } from '@/helpers/worlds'

defineProps<{
	partner: PartneredServer
	serverStatus?: ServerStatus
	refreshing: boolean
}>()

const router = useRouter()
const { formatMessage } = useVIntl()
const formatNumber = useFormatNumber()

const messages = defineMessages({
	partnered: {
		id: 'home.partnered.badge',
		defaultMessage: 'Partnered',
	},
	playersOnline: {
		id: 'home.partnered.players_online',
		defaultMessage: '{count} online',
	},
	offline: {
		id: 'home.partnered.offline',
		defaultMessage: 'Offline',
	},
	loading: {
		id: 'home.partnered.loading',
		defaultMessage: 'Loading...',
	},
	viewInfo: {
		id: 'home.partnered.view_info',
		defaultMessage: 'View more info',
	},
})
</script>

<template>
	<div
		class="group relative flex flex-col rounded-xl bg-bg-raised card-shadow overflow-clip cursor-pointer hover:brightness-90 transition-all"
		role="button"
		:aria-label="`${partner.name} - ${formatMessage(messages.viewInfo)}`"
		@click="router.push(`/server/${partner.id}`)"
	>
		<div class="relative w-full aspect-[2/1] overflow-hidden">
			<img
				:src="partner.bannerUrl"
				alt=""
				class="absolute inset-0 h-full w-full object-cover"
			/>
			<div class="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
			<TagItem
				class="absolute top-2 left-2 z-10 border !border-solid border-brand bg-highlight text-xs"
				:style="'--_color: var(--color-brand)'"
			>
				<BadgeCheckIcon aria-hidden="true" class="h-3.5 w-3.5" />
				{{ formatMessage(messages.partnered) }}
			</TagItem>
		</div>

		<div class="flex flex-col justify-center gap-2.5 px-4 py-4">
			<div class="flex gap-2 items-center">
				<Avatar :src="partner.logoUrl" size="48px" :tint-by="partner.address" alt="" />
				<div class="h-full flex items-center font-bold text-contrast leading-normal">
					<span class="line-clamp-2">{{ partner.name }}</span>
				</div>
			</div>
			<p class="m-0 text-sm font-medium line-clamp-3 leading-tight h-[3.25rem]">
				{{ partner.tagline }}
			</p>
			<div
				class="flex items-center justify-between gap-2 text-sm text-secondary font-semibold mt-auto"
			>
				<div class="flex items-center gap-1 min-w-0">
					<template v-if="refreshing">
						<SpinnerIcon class="animate-spin shrink-0" aria-hidden="true" />
						{{ formatMessage(messages.loading) }}
					</template>
					<template v-else-if="serverStatus">
						<UsersIcon class="shrink-0 text-green" aria-hidden="true" />
						{{
							formatMessage(messages.playersOnline, {
								count: formatNumber(serverStatus.players?.online ?? 0),
							})
						}}
					</template>
					<template v-else>
						<NoSignalIcon class="shrink-0" aria-hidden="true" />
						{{ formatMessage(messages.offline) }}
					</template>
				</div>
				<div class="flex items-center gap-1.5 shrink-0">
					<ButtonStyled v-if="partner.website" color="brand" circular type="transparent">
						<button :aria-label="partner.website" @click.stop="openUrl(partner.website!)">
							<GlobeIcon aria-hidden="true" />
						</button>
					</ButtonStyled>
				</div>
			</div>
		</div>
	</div>
</template>
