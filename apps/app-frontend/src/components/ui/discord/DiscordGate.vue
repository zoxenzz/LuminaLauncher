<script setup lang="ts">
import { DiscordColorIcon } from '@modrinth/assets'
import { ButtonStyled, defineMessages, useVIntl } from '@modrinth/ui'

import { useDiscord } from '@/store/discord'
import { config } from '@/config'

const { formatMessage } = useVIntl()
const discord = useDiscord()

const usesPlaceholderConfig =
	config.discord.clientId.startsWith('your_') || config.discord.guildId.startsWith('your_')

	const messages = defineMessages({
		loading: {
			id: 'discord.gate.loading',
			defaultMessage: 'Checking access...',
		},
		waitingForSignIn: {
			id: 'discord.gate.waiting-for-sign-in',
			defaultMessage:
				'Waiting for you to sign in at the browser window that just opened... You can close the page when done.',
		},
		title: {
			id: 'discord.gate.title',
			defaultMessage: 'Welcome to the Lumina Launcher',
		},
		subtitle: {
			id: 'discord.gate.subtitle',
			defaultMessage: 'Sign in with Discord to continue.',
		},
		signIn: {
			id: 'discord.gate.sign-in',
			defaultMessage: 'Sign in with Discord',
		},
		signInDescription: {
			id: 'discord.gate.sign-in.description',
			defaultMessage:
				'Lumina Launcher uses Discord as its account system. Sign in to sync your profile and get started.',
		},
		tryAgain: {
			id: 'discord.gate.try-again',
			defaultMessage: 'Try again',
		},
		signOut: {
			id: 'discord.gate.sign-out',
			defaultMessage: 'Sign out',
		},
		configNote: {
			id: 'discord.gate.config-note',
			defaultMessage:
				'Discord is not configured yet. Add your Discord application and guild IDs to the launcher configuration to enable access.',
		},
	})
</script>

<template>
	<div
		v-if="discord.requiresGate"
		class="discord-gate fixed inset-0 z-[5000] flex items-center justify-center"
	>
		<div class="flex flex-col items-center max-w-md px-8 text-center">
			<template v-if="discord.status === 'loading'">
				<h1 class="text-2xl font-extrabold m-0 text-contrast">
					{{ formatMessage(discord.isLoggingIn ? messages.waitingForSignIn : messages.loading) }}
				</h1>
			</template>

			<template v-else-if="discord.status === 'unauthenticated'">
				<h1 class="text-2xl font-extrabold m-0 text-contrast">
					{{ formatMessage(messages.title) }}
				</h1>
				<p class="mt-2 text-sm text-secondary leading-tight">
					{{ formatMessage(messages.subtitle) }}
				</p>
				<p class="mt-2 text-sm text-secondary leading-tight">
					{{ formatMessage(messages.signInDescription) }}
				</p>
				<p v-if="discord.errorMessage" class="mt-2 text-sm text-danger leading-tight">
					{{ discord.errorMessage }}
				</p>
				<ButtonStyled class="mt-6" color="brand">
					<button
						class="flex items-center gap-2"
						:disabled="discord.status === 'loading'"
						@click="discord.login()"
					>
						<DiscordColorIcon class="h-5 w-5" />
						{{ formatMessage(messages.signIn) }}
					</button>
				</ButtonStyled>
				<p v-if="usesPlaceholderConfig" class="mt-4 text-xs text-secondary leading-tight">
					{{ formatMessage(messages.configNote) }}
				</p>
			</template>
		</div>
	</div>
</template>

<style lang="scss" scoped>
.discord-gate {
	background-color: var(--color-bg);
	background-image: var(--brand-gradient-bg);
}
</style>
