const trimTrailingSlash = (url: string) => url.replace(/\/$/, '')

const siteUrl = trimTrailingSlash(import.meta.env.MODRINTH_URL || 'https://modrinth.com')
const labrinthBaseUrl = trimTrailingSlash(
	import.meta.env.MODRINTH_API_BASE_URL || 'https://api.modrinth.com',
)
const archonBaseUrl = trimTrailingSlash(
	import.meta.env.MODRINTH_ARCHON_BASE_URL || 'https://archon.modrinth.com',
)

// Lumina Launcher uses Discord as its account system.
// Replace these placeholders with your real values (see AGENTS.md / README):
//   VITE_DISCORD_CLIENT_ID      - OAuth2 client ID from https://discord.com/developers/applications
//   VITE_DISCORD_CLIENT_SECRET  - OAuth2 client secret for the same application
//   VITE_DISCORD_GUILD_ID       - ID of the Discord server users must belong to
//   VITE_DISCORD_ROLE_ID        - ID of the role users must have to use the launcher
const discordClientId = import.meta.env.VITE_DISCORD_CLIENT_ID || 'your_discord_client_id'
const discordClientSecret = import.meta.env.VITE_DISCORD_CLIENT_SECRET || 'your_discord_client_secret'
const discordGuildId = import.meta.env.VITE_DISCORD_GUILD_ID || 'your_discord_guild_id'
const discordRoleId = import.meta.env.VITE_DISCORD_ROLE_ID || 'your_discord_role_id'

export const config = {
	siteUrl,
	stripePublishableKey:
		import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
		'pk_test_51JbFxJJygY5LJFfKV50mnXzz3YLvBVe2Gd1jn7ljWAkaBlRz3VQdxN9mXcPSrFbSqxwAb0svte9yhnsmm7qHfcWn00R611Ce7b',
	labrinthBaseUrl,
	archonBaseUrl,
	discord: {
		clientId: discordClientId,
		clientSecret: discordClientSecret,
		guildId: discordGuildId,
		roleId: discordRoleId,
	},
}
