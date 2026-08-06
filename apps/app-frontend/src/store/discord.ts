import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { openUrl } from '@tauri-apps/plugin-opener'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { config } from '@/config'

const STORAGE_KEY = 'lumina-launcher.discord-session'

interface DiscordTokenResponse {
	access_token: string
	token_type: string
	expires_in: number
	scope: string
	refresh_token: string | null
}

export interface DiscordUser {
	id: string
	username: string
	global_name?: string | null
	discriminator?: string
	avatar?: string | null
}

interface StoredSession {
	token: DiscordTokenResponse
	user: DiscordUser
	issuedAt: number
}
const isUnauthorized = (error: unknown) =>
	typeof error === 'object' && error !== null && 'status' in error && error.status === 401

/** Rejects if the wrapped promise does not settle in time (network hangs). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('Discord request timed out')), ms)
		promise.then(
			(value) => {
				clearTimeout(timer)
				resolve(value)
			},
			(error) => {
				clearTimeout(timer)
				reject(error)
			},
		)
	})
}

function readStoredSession(): StoredSession | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		return raw ? (JSON.parse(raw) as StoredSession) : null
	} catch {
		return null
	}
}

export const useDiscord = defineStore('discord', () => {
	const status = ref<'loading' | 'authorized' | 'unauthenticated'>('loading')
	const user = ref<DiscordUser | null>(null)
	const members = ref<DiscordUser[]>([])
	const errorMessage = ref('')
	const isLoggingIn = ref(false)

	const isAuthorized = computed(() => status.value === 'authorized')

	const username = computed(() => user.value?.global_name || user.value?.username || 'Unknown user')

	function avatarUrl(size = 128): string | null {
		const account = user.value
		if (!account?.avatar) return null
		const extension = account.avatar.startsWith('a_') ? 'gif' : 'png'
		return `https://cdn.discordapp.com/avatars/${account.id}/${account.avatar}.${extension}?size=${size}`
	}

	function memberAvatar(member: DiscordUser, size = 128): string | null {
		if (!member.avatar) return null
		const extension = member.avatar.startsWith('a_') ? 'gif' : 'png'
		return `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.${extension}?size=${size}`
	}

	function openProfile() {
		if (user.value) {
			openUrl(`https://discord.com/users/${user.value.id}`)
		}
	}

	function clearSession() {
		localStorage.removeItem(STORAGE_KEY)
		user.value = null
		members.value = []
		errorMessage.value = ''
		status.value = 'unauthenticated'
	}

	function persistSession(session: StoredSession) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
	}

	async function refreshToken(refreshToken: string): Promise<DiscordTokenResponse> {
		const response = await tauriFetch('https://discord.com/api/oauth2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: {
				type: 'FormData',
				payload: {
					grant_type: 'refresh_token',
					client_id: config.discord.clientId,
					client_secret: config.discord.clientSecret,
					refresh_token: refreshToken,
				},
			},
		})
		if (!response.ok) {
			throw new Error(`Discord token refresh failed with status ${response.status}`)
		}
		return (await response.json()) as DiscordTokenResponse
	}

	async function withValidToken<T>(
		session: StoredSession,
		fetchFn: (token: string) => Promise<T>,
	): Promise<T> {
		if (
			session.token.refresh_token &&
			Date.now() - session.issuedAt >= session.token.expires_in * 1000 - 60000
		) {
			const refreshed = await refreshToken(session.token.refresh_token)
			session.token = {
				...refreshed,
				refresh_token: refreshed.refresh_token ?? session.token.refresh_token,
			}
			session.issuedAt = Date.now()
			persistSession(session)
		}

		try {
			return await fetchFn(session.token.access_token)
		} catch (error) {
			if (isUnauthorized(error) && session.token.refresh_token) {
				const refreshed = await refreshToken(session.token.refresh_token)
				session.token = {
					...refreshed,
					refresh_token: refreshed.refresh_token ?? session.token.refresh_token,
				}
				session.issuedAt = Date.now()
				persistSession(session)
				return await fetchFn(session.token.access_token)
			}
			throw error
		}
	}

	async function fetchUser(token: string): Promise<DiscordUser> {
		const response = await tauriFetch('https://discord.com/api/v10/users/@me', {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		})
		if (!response.ok) {
			throw { status: response.status, message: 'Failed to fetch Discord user' }
		}
		return (await response.json()) as DiscordUser
	}

	async function loadMembers(_accessToken: string) {
		members.value = []
	}

	async function establishSession(token: DiscordTokenResponse) {
		const userAccount = await withTimeout(fetchUser(token.access_token), 8000)

		const session: StoredSession = {
			token,
			user: userAccount,
			issuedAt: Date.now(),
		}
		persistSession(session)

		user.value = session.user
		try {
			await loadMembers(token.access_token)
		} catch {
			members.value = []
		}
		errorMessage.value = ''
		status.value = 'authorized'
		return session
	}

	async function init() {
		const stored = readStoredSession()
		if (!stored) {
			status.value = 'unauthenticated'
			return
		}

		status.value = 'loading'
		try {
			// Never leave the app in a perpetual "loading" state: if Discord is
			// unreachable, fall back to the stored session (best effort).
			const userAccount = await withTimeout(
				withValidToken(stored, (token) => fetchUser(token)),
				8000,
			)

			stored.user = userAccount
			persistSession(stored)
			try {
				await loadMembers(stored.token.access_token)
			} catch {
				members.value = []
			}

			user.value = stored.user
			errorMessage.value = ''
			status.value = 'authorized'
		} catch (error) {
			if (isUnauthorized(error)) {
				clearSession()
				return
			}
			user.value = stored.user
			errorMessage.value = ''
			status.value = 'authorized'
		}
	}

	async function login() {
		status.value = 'loading'
		isLoggingIn.value = true
		errorMessage.value = ''
		try {
			const token = await invoke<DiscordTokenResponse>('plugin:discord-auth|discord_login', {
				clientId: config.discord.clientId,
				clientSecret: config.discord.clientSecret,
			})
			await establishSession(token)
		} catch (error) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'message' in error &&
				typeof error.message === 'string' &&
				error.message.includes('Login canceled')
			) {
				status.value = 'unauthenticated'
				return
			}
			errorMessage.value =
				typeof error === 'object' && error !== null && 'message' in error
					? String(error.message)
					: 'Failed to sign in with Discord.'
			status.value = 'unauthenticated'
		} finally {
			isLoggingIn.value = false
		}
	}

	async function logout() {
		const stored = readStoredSession()
		if (stored) {
			invoke('plugin:discord-auth|discord_logout', {
				clientId: config.discord.clientId,
				clientSecret: config.discord.clientSecret,
				accessToken: stored.token.access_token,
			}).catch(() => {})
		}
		clearSession()
	}

	return {
		status,
		user,
		members,
		errorMessage,
		isLoggingIn,
		isAuthorized,
		username,
		avatarUrl,
		memberAvatar,
		openProfile,
		init,
		login,
		logout,
	}
})
