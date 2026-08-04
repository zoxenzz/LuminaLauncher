<script setup lang="ts">
import {
	BadgeCheckIcon,
	GlobeIcon,
	NoSignalIcon,
	SpinnerIcon,
	UsersIcon,
} from '@modrinth/assets'
import {
	Avatar,
	ButtonStyled,
	defineMessages,
	TagItem,
	useFormatNumber,
	useVIntl,
} from '@modrinth/ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { PARTNERED_SERVERS, type PartneredServer } from '@/helpers/partnered-servers'
import { withTimeout } from '@/helpers/utils'
import { refreshServerData, type ServerData } from '@/helpers/worlds'
import { useBreadcrumbs } from '@/store/breadcrumbs'

const route = useRoute()
const breadcrumbs = useBreadcrumbs()
const { formatMessage } = useVIntl()
const formatNumber = useFormatNumber()

const partner = computed<PartneredServer | undefined>(() =>
	PARTNERED_SERVERS.find((p) => p.id === route.params.id),
)

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
	website: {
		id: 'home.partnered.website',
		defaultMessage: 'Website',
	},
	serverAddress: {
		id: 'home.partnered.server_address',
		defaultMessage: 'Server address',
	},
	network: {
		id: 'home.partnered.network',
		defaultMessage: 'Network',
	},
	unknownServer: {
		id: 'home.partnered.unknown_server',
		defaultMessage: 'Unknown partnered server',
	},
})

const serverData = ref<ServerData>({ refreshing: true })

function refreshStatus() {
	if (!partner.value) return
	const data = serverData.value
	data.refreshing = true
	withTimeout(refreshServerData(data, null, partner.value.address), 8000, undefined).then(
		() => {
			if (!data.status) data.refreshing = false
		},
		() => {},
	)
}

watch(
	() => route.params.id,
	() => {
		if (partner.value) {
			breadcrumbs.setName('PartneredServer', partner.value.name)
			refreshStatus()
		}
	},
	{ immediate: true },
)

const refreshing = computed(() => serverData.value.refreshing && !serverData.value.status)

const bannerImageStyle = computed(() =>
	partner.value ? { backgroundImage: `url(${partner.value.bannerUrl})` } : undefined,
)
</script>

<template>
	<div v-if="partner" class="flex flex-col gap-6 p-6">
		<div class="relative h-60 rounded-2xl overflow-hidden flex items-center justify-center">
			<div
				v-if="bannerImageStyle"
				class="absolute inset-0 bg-cover bg-center"
				:style="bannerImageStyle"
			/>
			<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
			<div class="relative z-10 flex flex-col items-center gap-2 px-6 text-center">
				<Avatar :src="partner.logoUrl" size="lg" :tint-by="partner.address" raised alt="" />
				<h1 class="m-0 text-3xl font-extrabold text-white drop-shadow">{{ partner.name }}</h1>
				<p class="m-0 font-medium text-white/85">{{ partner.tagline }}</p>
			</div>
			<TagItem
				class="absolute top-3 left-3 z-10 border !border-solid border-brand bg-highlight text-xs"
				:style="'--_color: var(--color-brand)'"
			>
				<BadgeCheckIcon aria-hidden="true" class="h-3.5 w-3.5" />
				{{ formatMessage(messages.partnered) }}
			</TagItem>
		</div>

		<div class="rounded-xl bg-bg-raised card-shadow p-6 flex flex-col gap-6">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-2 text-sm text-secondary font-semibold">
					<template v-if="refreshing">
						<SpinnerIcon class="animate-spin shrink-0" aria-hidden="true" />
						{{ formatMessage(messages.loading) }}
					</template>
					<template v-else-if="serverData.status">
						<UsersIcon class="shrink-0 text-green" aria-hidden="true" />
						{{
							formatMessage(messages.playersOnline, {
								count: formatNumber(serverData.status.players?.online ?? 0),
							})
						}}
					</template>
					<template v-else>
						<NoSignalIcon class="shrink-0" aria-hidden="true" />
						{{ formatMessage(messages.offline) }}
					</template>
				</div>
				<div class="flex items-center gap-2">
					<ButtonStyled v-if="partner.website" color="brand" type="outlined">
						<button @click="openUrl(partner.website!)">
							<GlobeIcon aria-hidden="true" />
							{{ formatMessage(messages.website) }}
						</button>
					</ButtonStyled>
				</div>
			</div>

			<div class="flex flex-col gap-4 text-sm">
				<div class="flex items-center justify-between gap-3 border-b border-button-border pb-4">
					<span class="text-secondary font-semibold">
						{{ formatMessage(messages.serverAddress) }}
					</span>
					<span class="font-bold text-contrast">{{ partner.address }}</span>
				</div>
				<div class="flex items-center justify-between gap-3 border-b border-button-border pb-4">
					<span class="text-secondary font-semibold">{{ formatMessage(messages.network) }}</span>
					<span class="font-bold text-contrast">{{ partner.networkName }}</span>
				</div>
				<div v-if="partner.website" class="flex items-center justify-between gap-3">
					<span class="text-secondary font-semibold">
						{{ formatMessage(messages.website) }}
					</span>
					<a
						class="font-bold text-primary hover:underline cursor-pointer"
						@click="openUrl(partner.website!)"
					>
						{{ partner.website }}
					</a>
				</div>
			</div>
		</div>
	</div>
	<div v-else class="p-6 text-center text-secondary font-semibold">
		{{ formatMessage(messages.unknownServer) }}
	</div>
</template>
