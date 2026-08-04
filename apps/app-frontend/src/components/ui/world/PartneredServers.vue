<script setup lang="ts">
import { LoaderCircleIcon } from '@modrinth/assets'
import { defineMessages, useVIntl } from '@modrinth/ui'
import { onMounted, onUnmounted, ref } from 'vue'

import PartneredServerCard from '@/components/ui/world/PartneredServerCard.vue'
import { profile_listener } from '@/helpers/events'
import { PARTNERED_SERVERS } from '@/helpers/partnered-servers'
import { withTimeout } from '@/helpers/utils'
import { refreshServerData, type ServerData } from '@/helpers/worlds'
import { useTheming } from '@/store/theme'

const { formatMessage } = useVIntl()
const theme = useTheming()

const messages = defineMessages({
	partneredServers: {
		id: 'home.partnered.title',
		defaultMessage: 'Partnered Servers',
	},
})

const serverData = ref<Record<string, ServerData>>({})

function refreshPartners() {
	for (const partner of PARTNERED_SERVERS) {
		if (!serverData.value[partner.address]) {
			serverData.value[partner.address] = { refreshing: true }
		}
		const data = serverData.value[partner.address]
		withTimeout(refreshServerData(data, null, partner.address), 8000, undefined).then(
			() => {
				if (!data.status) data.refreshing = false
			},
			() => {},
		)
	}
}

let unlistenProfiles: (() => void) | undefined

onMounted(async () => {
	unlistenProfiles = await profile_listener(async () => {
		refreshPartners()
	})
})

onUnmounted(() => {
	unlistenProfiles?.()
})

refreshPartners()
</script>

<template>
	<div v-if="theme?.getFeatureFlag?.('partnered_servers_home')" class="flex flex-col gap-3">
		<span class="flex mt-2 mb-1 leading-none items-center gap-1 text-primary text-lg font-bold">
			{{ formatMessage(messages.partneredServers) }}
		</span>
		<div v-if="PARTNERED_SERVERS.length > 0" class="grid-when-huge grid gap-4">
			<PartneredServerCard
				v-for="partner in PARTNERED_SERVERS"
				:key="partner.id"
				:partner="partner"
				:server-status="serverData[partner.address]?.status"
				:refreshing="
					serverData[partner.address]?.refreshing && !serverData[partner.address]?.status
				"
			/>
		</div>
		<div v-else class="text-center py-4">
			<LoaderCircleIcon class="mx-auto size-8 animate-spin text-contrast" />
		</div>
	</div>
</template>

<style scoped lang="scss">
.grid-when-huge {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
}
</style>
