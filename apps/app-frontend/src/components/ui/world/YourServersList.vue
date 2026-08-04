<script setup lang="ts">
import { LoaderCircleIcon, ServerIcon } from '@modrinth/assets'
import type { GameVersion } from '@modrinth/ui'
import { defineMessages, HeadingLink, injectNotificationManager, useVIntl } from '@modrinth/ui'
import dayjs from 'dayjs'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import YourServerCard from '@/components/ui/world/YourServerCard.vue'
import { trackEvent } from '@/helpers/analytics'
import { process_listener, profile_listener } from '@/helpers/events'
import {
	canAutoInstallModpack,
	detectServerModpackRequirement,
	type ModpackRequirement,
} from '@/helpers/modpack-detection'
import { get_all } from '@/helpers/process'
import { kill, list } from '@/helpers/profile'
import { get_game_versions } from '@/helpers/tags'
import type { GameInstance } from '@/helpers/types'
import { withTimeout } from '@/helpers/utils'
import {
	get_profile_protocol_version,
	get_recent_worlds,
	hasServerQuickPlaySupport,
	normalizeServerAddress,
	type ProtocolVersion,
	refreshServerData,
	type ServerData,
	set_world_display_status,
	start_join_server,
	type WorldWithProfile,
} from '@/helpers/worlds'
import { injectServerInstall } from '@/providers/server-install'
import { handleSevereError } from '@/store/error'
import { useTheming } from '@/store/theme'

const { handleError } = injectNotificationManager()
const { formatMessage } = useVIntl()
const theme = useTheming()
const { playServerProject } = injectServerInstall()

const messages = defineMessages({
	yourServers: {
		id: 'home.yourServers.title',
		defaultMessage: 'Your Servers',
	},
	emptyTitle: {
		id: 'home.yourServers.empty_title',
		defaultMessage: 'No servers joined yet',
	},
	emptyDescription: {
		id: 'home.yourServers.empty_description',
		defaultMessage: 'Servers you join or pin will show up here so you can jump back in quickly.',
	},
	loading: {
		id: 'home.yourServers.loading',
		defaultMessage: 'Loading your servers...',
	},
})

const instances = ref<GameInstance[]>([])
const serverWorlds = ref<WorldWithProfile[]>([])
const serverData = ref<Record<string, ServerData>>({})
const protocolVersions = ref<Record<string, ProtocolVersion | null>>({})
const gameVersions = ref<GameVersion[]>([])
const loading = ref(true)
const runningInstances = ref<string[]>([])

const instancesByPath = computed(() => new Map(instances.value.map((i) => [i.path, i])))

type ServerCard = {
	world: WorldWithProfile
	requirement: ModpackRequirement
	autoInstall: boolean
	playing: boolean
	supportsQuickPlay: boolean
}

const cards = computed<ServerCard[]>(() => {
	const byAddress = new Map<string, WorldWithProfile>()
	for (const world of serverWorlds.value) {
		const key = normalizeServerAddress(world.world.address) || world.world.address
		const existing = byAddress.get(key)
		if (!existing) {
			byAddress.set(key, world)
			continue
		}
		const existingPinned = existing.world.display_status === 'favorite'
		const newPinned = world.world.display_status === 'favorite'
		if (newPinned && !existingPinned) {
			byAddress.set(key, world)
		} else if (existingPinned === newPinned) {
			const existingPlayed = dayjs(existing.world.last_played ?? 0).valueOf()
			const newPlayed = dayjs(world.world.last_played ?? 0).valueOf()
			if (newPlayed > existingPlayed) byAddress.set(key, world)
		}
	}

	return [...byAddress.values()]
		.sort((a, b) => {
			const aPinned = a.world.display_status === 'favorite'
			const bPinned = b.world.display_status === 'favorite'
			if (aPinned !== bPinned) return aPinned ? -1 : 1
			const aPlayed = dayjs(a.world.last_played ?? 0).valueOf()
			const bPlayed = dayjs(b.world.last_played ?? 0).valueOf()
			return bPlayed - aPlayed
		})
		.map((world) => {
			const address = world.world.address
			const requirement = detectServerModpackRequirement(
				world.world,
				serverData.value[address]?.rawMotd,
			)
			const instance = instancesByPath.value.get(world.profile)
			return {
				world,
				requirement,
				autoInstall: canAutoInstallModpack(world.world, requirement),
				playing: runningInstances.value.includes(world.profile),
				supportsQuickPlay:
					!instance || hasServerQuickPlaySupport(gameVersions.value, instance.game_version || ''),
			}
		})
})

async function fetchServers() {
	const [worlds, allInstances] = await Promise.all([
		withTimeout(get_recent_worlds(500, ['normal', 'favorite']), 8000, []).catch(() => []),
		withTimeout(list(), 5000, []).catch(() => []),
	])
	instances.value = allInstances
	serverWorlds.value = (worlds ?? []).filter((w) => w?.world?.type === 'server')

	const uniqueProfiles = [...new Set(serverWorlds.value.map((w) => w.profile))]
	await Promise.all(
		uniqueProfiles.map((path) =>
			withTimeout(get_profile_protocol_version(path), 5000, null)
				.then((protoVersion) => {
					if (protoVersion) protocolVersions.value[path] = protoVersion
				})
				.catch(() => {
					console.error(`Failed to get profile protocol for: ${path} `)
				}),
		),
	)

	const addresses = [...new Set(serverWorlds.value.map((w) => w.world.address))]
	addresses.forEach((address) => {
		if (!serverData.value[address]) {
			serverData.value[address] = { refreshing: true }
		}
	})
	const deduped = cards.value
	deduped.forEach(({ world }) => {
		const address = world.world.address
		const data = serverData.value[address]
		withTimeout(
			refreshServerData(data, protocolVersions.value[world.profile] ?? null, address),
			8000,
			undefined,
		).then(
			() => {
				if (!data.status) data.refreshing = false
			},
			() => {},
		)
	})
}

async function togglePin(world: WorldWithProfile) {
	const newStatus = world.world.display_status === 'favorite' ? 'normal' : 'favorite'
	await set_world_display_status(world.profile, 'server', world.world.address, newStatus).catch(
		handleError,
	)
	await fetchServers().catch(handleError)
}

async function playServer(card: ServerCard) {
	const { world } = card
	const instance = instancesByPath.value.get(world.profile)
	try {
		if (world.world.project_id) {
			await playServerProject(world.world.project_id)
		} else {
			await start_join_server(world.profile, world.world.address)
		}
	} catch (err) {
		handleSevereError(err, { profilePath: world.profile })
	}
	if (instance) {
		trackEvent('InstanceStart', {
			loader: instance.loader,
			game_version: instance.game_version,
			source: 'YourServersList',
		})
	}
}

async function stopServer(world: WorldWithProfile) {
	await kill(world.profile).catch(handleError)
	trackEvent('InstanceStop', {
		source: 'YourServersList',
	})
}

async function checkProcesses() {
	const runningProcesses = await get_all().catch(handleError)
	runningInstances.value = runningProcesses.map((x) => x.profile_path)
}

let unlistenProcesses: (() => void) | undefined
let unlistenProfiles: (() => void) | undefined

onMounted(async () => {
	unlistenProcesses = await process_listener(async () => {
		await checkProcesses()
	})
	unlistenProfiles = await profile_listener(async () => {
		await fetchServers().catch(handleError)
	})
	checkProcesses()
})

onUnmounted(() => {
	unlistenProcesses?.()
	unlistenProfiles?.()
})

gameVersions.value = await withTimeout(get_game_versions(), 5000, []).catch(() => [])
await fetchServers().catch(handleError)
loading.value = false
</script>

<template>
	<div class="flex flex-col gap-2">
		<HeadingLink v-if="theme?.getFeatureFlag?.('worlds_tab')" to="/worlds" class="mt-1">
			{{ formatMessage(messages.yourServers) }}
		</HeadingLink>
		<span
			v-else
			class="flex mt-1 mb-1 leading-none items-center gap-1 text-primary text-lg font-bold"
		>
			{{ formatMessage(messages.yourServers) }}
		</span>

		<div v-if="loading" class="text-center py-4">
			<LoaderCircleIcon class="mx-auto size-8 animate-spin text-contrast" />
		</div>
		<div v-else-if="cards.length > 0" class="grid-when-huge grid gap-3">
			<YourServerCard
				v-for="card in cards"
				:key="`${card.world.profile}-${card.world.world.address}`"
				:world="card.world"
				:instance="instancesByPath.get(card.world.profile)"
				:server-status="serverData[card.world.world.address]?.status"
				:refreshing="
					serverData[card.world.world.address]?.refreshing &&
					!serverData[card.world.world.address]?.status
				"
				:requirement="card.requirement"
				:auto-install="card.autoInstall"
				:playing="card.playing"
				:supports-quick-play="card.supportsQuickPlay"
				@play="playServer(card)"
				@stop="stopServer(card.world)"
				@pin="togglePin(card.world)"
			/>
		</div>
		<div v-else class="flex flex-col items-center gap-1 py-6 text-center">
			<ServerIcon class="size-8 text-secondary" />
			<p class="m-0 font-bold text-contrast">{{ formatMessage(messages.emptyTitle) }}</p>
			<p class="m-0 text-sm text-secondary">{{ formatMessage(messages.emptyDescription) }}</p>
		</div>
	</div>
</template>

<style scoped lang="scss">
.grid-when-huge {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
}
</style>
