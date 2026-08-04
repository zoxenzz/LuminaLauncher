<script setup lang="ts">
import { DiscordIcon, ExternalIcon, LogOutIcon } from '@modrinth/assets'
import { Avatar, ButtonStyled, defineMessages, useVIntl } from '@modrinth/ui'

import { useDiscord } from '@/store/discord'

const { formatMessage } = useVIntl()
const discord = useDiscord()

const messages = defineMessages({
	heading: {
		id: 'discord.panel.heading',
		defaultMessage: 'Discord',
	},
	connectedAs: {
		id: 'discord.panel.connected-as',
		defaultMessage: 'Connected as',
	},
	friends: {
		id: 'discord.panel.friends',
		defaultMessage: 'Friends on Lumina Launcher',
	},
	viewProfile: {
		id: 'discord.panel.view-profile',
		defaultMessage: 'View Discord profile',
	},
	signOut: {
		id: 'discord.panel.sign-out',
		defaultMessage: 'Sign out',
	},
	note: {
		id: 'discord.panel.note',
		defaultMessage: 'Your account and friends stay linked through Discord.',
	},
})
</script>

<template>
	<div v-if="discord.isAuthorized" class="flex flex-col gap-3">
		<h3 class="text-base text-primary font-medium m-0">{{ formatMessage(messages.heading) }}</h3>
		<div class="flex items-center gap-2">
			<Avatar :src="discord.avatarUrl(48) ?? ''" alt="" size="48px" circle />
			<div class="flex flex-col min-w-0">
				<span class="text-sm text-contrast font-semibold truncate">{{ discord.username }}</span>
				<span class="text-xs text-secondary">{{ formatMessage(messages.connectedAs) }}</span>
			</div>
		</div>
		<div v-if="discord.members.length > 0" class="flex flex-col gap-1">
			<h4 class="text-xs text-secondary font-semibold uppercase m-0 mt-1">
				{{ formatMessage(messages.friends) }}
			</h4>
			<div
				v-for="member in discord.members"
				:key="member.id"
				class="flex items-center gap-2 py-1"
			>
				<Avatar
					v-if="discord.memberAvatar(member)"
					:src="discord.memberAvatar(member)!"
					alt=""
					size="28px"
					circle
				/>
				<span
					v-else
					class="min-w-7 min-h-7 bg-button-bg rounded-full flex items-center justify-center text-xs font-bold text-contrast"
				>
					{{ (member.global_name || member.username || '?').trim()[0]?.toUpperCase() ?? '?' }}
				</span>
				<span class="text-sm text-primary truncate">{{ member.global_name || member.username }}</span>
			</div>
		</div>
		<p class="text-xs text-secondary leading-tight m-0">{{ formatMessage(messages.note) }}</p>
		<div class="flex gap-2 mt-1">
			<ButtonStyled type="transparent" circular>
				<button
					v-tooltip="formatMessage(messages.viewProfile)"
					:aria-label="formatMessage(messages.viewProfile)"
					@click="discord.openProfile()"
				>
					<ExternalIcon />
				</button>
			</ButtonStyled>
			<ButtonStyled type="transparent" circular>
				<button
					v-tooltip="formatMessage(messages.signOut)"
					:aria-label="formatMessage(messages.signOut)"
					@click="discord.logout()"
				>
					<LogOutIcon />
				</button>
			</ButtonStyled>
		</div>
	</div>
	<div v-else class="flex flex-col gap-2">
		<h3 class="text-base text-primary font-medium m-0">{{ formatMessage(messages.heading) }}</h3>
		<div class="flex items-center gap-2 text-sm text-secondary">
			<DiscordIcon class="h-5 w-5 text-brand shrink-0" />
			<span>{{ formatMessage(messages.note) }}</span>
		</div>
	</div>
</template>
