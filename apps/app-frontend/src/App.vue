<script setup>
import {
	AuthFeature,
	ModrinthApiError,
	NodeAuthFeature,
	nodeAuthState,
	PanelVersionFeature,
	TauriModrinthClient,
	VerboseLoggingFeature,
} from '@modrinth/api-client'
import {
	ChangeSkinIcon,
	CircleAlertIcon,
	CompassIcon,
	ExternalIcon,
	HomeIcon,
	LeftArrowIcon,
	LibraryIcon,
	LogInIcon,
	LogOutIcon,
	NotepadTextIcon,
	PlusIcon,
	RightArrowIcon,
	ServerStackIcon,
	SettingsIcon,
	SpinnerIcon,
	UserIcon,
	WorldIcon,
	XIcon,
} from '@modrinth/assets'
import {
	Admonition,
	Avatar,
	ButtonStyled,
	commonMessages,
	ContentInstallModal,
	ContentUpdaterModal,
	CreationFlowModal,
	defineMessages,
	I18nDebugPanel,
	LoadingIndicator,
	NotificationPanel,
	OverflowMenu,
	PopupNotificationPanel,
	provideModalBehavior,
	provideModrinthClient,
	provideNotificationManager,
	providePageContext,
	providePopupNotificationManager,
	useDebugLogger,
	useHostingIntercom,
	useVIntl,
} from '@modrinth/ui'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { openUrl } from '@tauri-apps/plugin-opener'
import { type } from '@tauri-apps/plugin-os'
import { $fetch } from 'ofetch'
import {
	computed,
	nextTick,
	onErrorCaptured,
	onMounted,
	onUnmounted,
	provide,
	ref,
	watch,
} from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import AccountsCard from '@/components/ui/AccountsCard.vue'
import AppActionBar from '@/components/ui/AppActionBar.vue'
import Breadcrumbs from '@/components/ui/Breadcrumbs.vue'
import DiscordPanel from '@/components/ui/discord/DiscordPanel.vue'
import ErrorModal from '@/components/ui/ErrorModal.vue'
import AddServerToInstanceModal from '@/components/ui/install_flow/AddServerToInstanceModal.vue'
import UnknownPackWarningModal from '@/components/ui/install_flow/UnknownPackWarningModal.vue'
import MinecraftAuthErrorModal from '@/components/ui/minecraft-auth-error-modal/MinecraftAuthErrorModal.vue'
import AppSettingsModal from '@/components/ui/modal/AppSettingsModal.vue'
import InstallToPlayModal from '@/components/ui/modal/InstallToPlayModal.vue'
import ModpackAlreadyInstalledModal from '@/components/ui/modal/ModpackAlreadyInstalledModal.vue'
import UpdateToPlayModal from '@/components/ui/modal/UpdateToPlayModal.vue'
import NavButton from '@/components/ui/NavButton.vue'
import QuickInstanceSwitcher from '@/components/ui/QuickInstanceSwitcher.vue'
import SplashScreen from '@/components/ui/SplashScreen.vue'
import WindowControls from '@/components/ui/WindowControls.vue'
import { cardExpandActive } from '@/composables/useCardExpandTransition'
import { useCheckDisableMouseover } from '@/composables/macCssFix.js'
import { config } from '@/config'
import { check_reachable } from '@/helpers/auth.js'
import { get_user, get_version } from '@/helpers/cache.js'
import {
	command_listener,
	info_listener,
	notification_listener,
	warning_listener,
} from '@/helpers/events.js'
// This code line modified by Lumina Launcher
import UpdateToast from '@/components/ui/lumina/UpdateToast.vue'
import { create_profile_and_install_from_file } from '@/helpers/pack'
import { list } from '@/helpers/profile.js'
import { mergeUrlQuery, parseModrinthLink } from '@/helpers/project-links.ts'
import { get as getSettings, set as setSettings } from '@/helpers/settings.ts'
import { get_opening_command, initialize_state } from '@/helpers/state'
import { getOS, isDev } from '@/helpers/utils.js'
import i18n from '@/i18n.config'
import { createContentInstall, provideContentInstall } from '@/providers/content-install'
import { provideAppUpdateDownloadProgress } from '@/providers/download-progress.ts'
import { createServerInstall, provideServerInstall } from '@/providers/server-install'
import { setupProviders } from '@/providers/setup'
import { setupAuthProvider } from '@/providers/setup/auth'
import { setupLoadingStateProvider } from '@/providers/setup/loading-state'
import { useDiscord } from '@/store/discord'
import { useUpdater } from '@/store/updater'
import { useError } from '@/store/error.js'
import { useTheming } from '@/store/state'

import { generateSkinPreviews } from './helpers/rendering/batch-skin-renderer'
import { get_available_capes, get_available_skins } from './helpers/skins'
import { AppNotificationManager } from './providers/app-notifications'
import { AppPopupNotificationManager } from './providers/app-popup-notifications'

const themeStore = useTheming()
const router = useRouter()
const route = useRoute()
const APP_SIDEBAR_WIDTH = 300
const INTERCOM_BUBBLE_DEFAULT_PADDING = 20
const credentials = ref()
const discord = useDiscord()
const updater = useUpdater()
const sidebarToggled = ref(true)
const unsubscribeSidebarToggle = themeStore.$subscribe(() => {
	sidebarToggled.value = !themeStore.toggleSidebar
})
const forceSidebar = computed(
	() => route.path.startsWith('/browse') || route.path.startsWith('/project'),
)
const sidebarVisible = computed(() => sidebarToggled.value || forceSidebar.value)
const hostingRouteActive = computed(() => route.path.startsWith('/hosting'))
const hostingIntercomIdentityKey = computed(() => {
	const rawServerId = route.params.id
	const serverId = Array.isArray(rawServerId) ? rawServerId[0] : rawServerId
	const userId = credentials.value?.user_id ?? credentials.value?.user?.id ?? 'anonymous'
	return `${userId}:${serverId ?? 'hosting'}`
})
const hostingIntercom = useHostingIntercom({
	enabled: computed(() => hostingRouteActive.value && !!credentials.value?.session),
	appId: 'ykeritl9',
	fetchToken: fetchIntercomToken,
	identityKey: hostingIntercomIdentityKey,
	horizontalPadding: computed(() =>
		sidebarVisible.value
			? APP_SIDEBAR_WIDTH + INTERCOM_BUBBLE_DEFAULT_PADDING
			: INTERCOM_BUBBLE_DEFAULT_PADDING,
	),
})

const notificationManager = new AppNotificationManager()
provideNotificationManager(notificationManager)
const { handleError, addNotification } = notificationManager

const popupNotificationManager = new AppPopupNotificationManager()
providePopupNotificationManager(popupNotificationManager)
const { addPopupNotification } = popupNotificationManager

const settingsModal = ref(null)

const appVersion = getVersion()
const tauriApiClient = new TauriModrinthClient({
	userAgent: async () => `modrinth/theseus/${await appVersion} (support@modrinth.com)`,
	labrinthBaseUrl: config.labrinthBaseUrl,
	archonBaseUrl: config.archonBaseUrl,
	features: [
		new NodeAuthFeature({
			getAuth: () => nodeAuthState.getAuth?.() ?? null,
			refreshAuth: async () => {
				if (nodeAuthState.refreshAuth) {
					await nodeAuthState.refreshAuth()
				}
			},
		}),
		new AuthFeature({
			token: async () => null,
		}),
		new PanelVersionFeature(),
		new VerboseLoggingFeature(),
	],
})
provideModrinthClient(tauriApiClient)
// Kept for its side effect: warms the authenticated-user cache once signed in
useQuery({
	queryKey: computed(() => ['authenticated-user', 'campaigns', credentials.value?.user?.id]),
	queryFn: () => tauriApiClient.labrinth.users_v3.getAuthenticated(),
	enabled: () => !!credentials.value?.session,
	retry: false,
})
providePageContext({
	hierarchicalSidebarAvailable: ref(true),
	floatingActionBarOffsets: {
		// No left nav rail anymore — the dock floats at the bottom, so bars span full width
		left: ref('0px'),
		right: computed(() => (sidebarVisible.value ? `${APP_SIDEBAR_WIDTH}px` : '0px')),
	},
	intercomBubble: hostingIntercom.intercomBubble,
	featureFlags: {
		serverRamAsBytesAlwaysOn: computed(() =>
			themeStore.getFeatureFlag('server_ram_as_bytes_always_on'),
		),
	},
	openExternalUrl: (url) => openUrl(url),
})
provideModalBehavior({
	noblur: computed(() => !themeStore.advancedRendering),
})

const {
	installationModal,
	unknownPackWarningModal,
	fetchExistingInstanceNames,
	handleCreate,
	handleBrowseModpacks,
	searchModpacks,
	getProjectVersions,
	getLoaderManifest,
	setModpackAlreadyInstalledModal,
	handleModpackDuplicateCreateAnyway,
	handleModpackDuplicateGoToInstance,
} = setupProviders(notificationManager, popupNotificationManager)

const availableSurvey = ref(false)
const displayedServerInviteNotifications = new Set()

const offline = ref(!navigator.onLine)
window.addEventListener('offline', () => {
	offline.value = true
})
window.addEventListener('online', () => {
	offline.value = false
})

const showOnboarding = ref(false)
const nativeDecorations = ref(false)

const os = ref('')
const isDevEnvironment = ref(false)

const stateInitialized = ref(false)

const isMaximized = ref(false)

const authUnreachableDebug = useDebugLogger('AuthReachableChecker')
const authServerQuery = useQuery({
	queryKey: ['authServerReachability'],
	queryFn: async () => {
		await check_reachable()
		authUnreachableDebug('Auth servers are reachable')
		return true
	},
	refetchInterval: 5 * 60 * 1000, // 5 minutes
	retry: false,
	refetchOnWindowFocus: false,
})

const authUnreachable = computed(() => {
	if (authServerQuery.isError.value && !authServerQuery.isLoading.value) {
		console.warn('Failed to reach auth servers', authServerQuery.error.value)
		return true
	}
	return false
})

// This code is modified by Lumina Launcher
onMounted(async () => {
	await useCheckDisableMouseover()
	// This code line modified by Lumina Launcher
	await updater.init()
	if (updater.isUpdateAvailable.value) {
		if (updater.isAutoUpdating.value) {
			addPopupNotification({
				title: formatMessage(messages.launcherAutoUpdatingTitle),
				text: formatMessage(messages.launcherAutoUpdatingText),
				type: 'info',
				autoCloseMs: 8000,
			})
		} else {
			addPopupNotification({
				title: formatMessage(messages.launcherUpdateAvailableTitle),
				text: formatMessage(messages.launcherUpdateAvailableText),
				type: 'info',
				autoCloseMs: 12000,
				buttons: [
					{
						label: formatMessage(messages.launcherUpdateAvailableAction),
						action: () => settingsModal.value?.showUpdateModal?.(),
						color: 'brand',
					},
				],
			})
		}
	}

	document.querySelector('body').addEventListener('click', handleClick)
	document.querySelector('body').addEventListener('auxclick', handleAuxClick)
})

onUnmounted(async () => {
	document.querySelector('body').removeEventListener('click', handleClick)
	document.querySelector('body').removeEventListener('auxclick', handleAuxClick)
	window.removeEventListener('resize', updateDockIndicator)
	unsubscribeSidebarToggle()
})

const { formatMessage } = useVIntl()

const messages = defineMessages({
	authUnreachableHeader: {
		id: 'app.auth-servers.unreachable.header',
		defaultMessage: 'Cannot reach authentication servers',
	},
	authUnreachableBody: {
		id: 'app.auth-servers.unreachable.body',
		defaultMessage:
			'Minecraft authentication servers may be down right now. Check your internet connection and try again later.',
	},
	launcherUpdateAvailableTitle: {
		id: 'lumina.app.launcher-update.available.title',
		defaultMessage: 'Launcher update available',
	},
	launcherUpdateAvailableText: {
		id: 'lumina.app.launcher-update.available.text',
		defaultMessage: 'New version of Lumina Launcher is available for download.',
	},
	launcherUpdateAvailableAction: {
		id: 'lumina.app.launcher-update.available.action',
		defaultMessage: 'View update',
	},
	launcherAutoUpdatingTitle: {
		id: 'lumina.app.launcher-update.auto.title',
		defaultMessage: 'Updating Lumina Launcher',
	},
	launcherAutoUpdatingText: {
		id: 'lumina.app.launcher-update.auto.text',
		defaultMessage: 'A new version is being downloaded and installed automatically.',
	},
	discordNotConfigured: {
		id: 'lumina.app.discord.not-configured',
		defaultMessage: "Discord sign-in isn't configured in this build.",
	},
})

// This code is modified by Lumina Launcher
async function setupApp() {
	// This code line modified by Lumina Launcher
	const settings = await getSettings()
	// This code line modified by Lumina Launcher
	settings.personalized_ads = false
	// This code line modified by Lumina Launcher
	settings.telemetry = false
	// This code line modified by Lumina Launcher
	await setSettings(settings)
	// This code line modified by Lumina Launcher
	console.info('[Lumina Launcher] Privacy hard-patch applied', {
		telemetry: settings.telemetry,
		personalized_ads: settings.personalized_ads,
	})

	const {
		native_decorations,
		locale,
		collapsed_navigation,
		hide_nametag_skins_page,
		advanced_rendering,
		onboarded,
		default_page,
		toggle_sidebar,
		developer_mode,
		feature_flags,
		pending_update_toast_for_version,
	} = await getSettings()

	// Initialize locale from saved settings
	if (locale) {
		i18n.global.locale.value = locale
	}

	if (default_page === 'Library') {
		await router.push('/library')
	}

	os.value = await getOS()
	const dev = await isDev()
	isDevEnvironment.value = dev
	showOnboarding.value = !onboarded

	nativeDecorations.value = native_decorations
	if (os.value !== 'MacOS') await getCurrentWindow().setDecorations(native_decorations)

	// Lumina is dark-only and locked to the gold brand accent — themes are not supported
	themeStore.setThemeState()
	themeStore.collapsedNavigation = collapsed_navigation
	themeStore.advancedRendering = advanced_rendering
	themeStore.hideNametagSkinsPage = hide_nametag_skins_page
	themeStore.toggleSidebar = toggle_sidebar
	themeStore.devMode = developer_mode
	themeStore.featureFlags = feature_flags
	stateInitialized.value = true

	isMaximized.value = await getCurrentWindow().isMaximized()

	await getCurrentWindow().onResized(async () => {
		isMaximized.value = await getCurrentWindow().isMaximized()
	})

	if (!dev) document.addEventListener('contextmenu', (event) => event.preventDefault())

	const osType = await type()
	if (osType === 'macos') {
		document.getElementsByTagName('html')[0].classList.add('mac')
	} else {
		document.getElementsByTagName('html')[0].classList.add('windows')
	}

	await warning_listener((e) =>
		addNotification({
			title: 'Warning',
			text: e.message,
			type: 'warn',
		}),
	)

	await info_listener((e) =>
		addNotification({
			title: 'Info',
			text: e.message,
			type: 'info',
			autoCloseMs: 8000,
		}),
	)

	get_opening_command().then(handleCommand)
	discord.init()

	try {
		const skins = (await get_available_skins()) ?? []
		const capes = (await get_available_capes()) ?? []
		generateSkinPreviews(skins, capes)
	} catch (error) {
		console.warn('Failed to generate skin previews in app setup.', error)
	}

	if (pending_update_toast_for_version !== null) {
		const settings = await getSettings()
		settings.pending_update_toast_for_version = null
		await setSettings(settings)
	}

	if (osType === 'windows') {
		await processPendingSurveys()
	} else {
		console.info('Skipping user surveys on non-Windows platforms')
	}
}

const stateFailed = ref(false)
const debugErrors = ref([])
window.__appErrors__ = debugErrors.value
window.addEventListener('error', (event) => {
	const message = String(event.message ?? '')
	// ResizeObserver loop warnings are benign browser notifications (e.g. fired when
	// toggling the sidebar reshuffles observed containers) — don't surface them.
	if (
		/ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i.test(message)
	)
		return
	debugErrors.value.push(`[window.error] ${message}`)
})
initialize_state()
	.then(() => {
		setupApp().catch((err) => {
			stateFailed.value = true
			stateInitialized.value = true
			console.error(err)
			error.showError(err, null, false, 'state_init')
		})
	})
	.catch((err) => {
		stateFailed.value = true
		stateInitialized.value = true
		console.error('Failed to initialize app', err)
		error.showError(err, null, false, 'state_init')
	})

const loading = setupLoadingStateProvider()
loading.setEnabled(false)
let initialLoadToken = loading.begin()

const suspensePending = ref(false)

function onSuspensePending() {
	suspensePending.value = true
}

function onSuspenseResolve() {
	suspensePending.value = false
}

let routerToken = null

router.beforeEach(() => {
	if (!routerToken) {
		routerToken = loading.begin()
	}
})

router.afterEach(() => {
	if (routerToken) {
		loading.end(routerToken)
		routerToken = null
	}
})

router.onError(() => {
	if (routerToken) {
		loading.end(routerToken)
		routerToken = null
	}
})

onErrorCaptured((err, instance, info) => {
	console.error('[App] Suspense error captured:', err, info)
	suspensePending.value = false
	if (routerToken) {
		loading.end(routerToken)
		routerToken = null
	}
	return false
})

const sidebarOverlayScrollbarsOptions = Object.freeze({
	overflow: {
		x: 'hidden',
		y: 'scroll',
	},
})

// Sliding active indicator for the bottom dock — one line that glides between icons
const dockNavCluster = ref(null)
const dockActiveIndicator = ref(null)

function updateDockIndicator() {
	const cluster = dockNavCluster.value
	const indicator = dockActiveIndicator.value
	if (!cluster || !indicator) return

	// Prefer the exact/subpage match first: vue-router applies
	// `router-link-active` to the root Home link on *every* route (prefix
	// match), so reading that class first would pin the indicator to Home.
	const active =
		cluster.querySelector('.router-link-exact-active, .subpage-active') ??
		cluster.querySelector('.router-link-active')
	if (!active) {
		indicator.style.opacity = '0'
		return
	}

	indicator.style.width = `${active.offsetWidth}px`
	indicator.style.height = `${active.offsetHeight}px`
	indicator.style.left = `${active.offsetLeft}px`
	indicator.style.top = `${active.offsetTop}px`
	indicator.style.opacity = '1'
}

watch(
	() => route.fullPath,
	async () => {
		await nextTick()
		updateDockIndicator()
	},
)

watch(
	() => themeStore.featureFlags.worlds_tab,
	async () => {
		await nextTick()
		updateDockIndicator()
	},
)

watch(stateInitialized, async (ready) => {
	if (ready) {
		await nextTick()
		updateDockIndicator()
		if (initialLoadToken) {
			loading.end(initialLoadToken)
			initialLoadToken = null
		}
	}
})

const queryClient = useQueryClient()

watch(stateInitialized, (ready) => {
	if (ready) {
		queryClient.prefetchQuery({
			queryKey: ['servers'],
			queryFn: async () => {
				const response = await tauriApiClient.archon.servers_v0.list({ limit: 100 })
				const hasMedalServers = response.servers.some((s) => s.is_medal)
				if (hasMedalServers) {
					const subscriptions = await tauriApiClient.labrinth.billing_internal.getSubscriptions()
					for (const server of response.servers) {
						if (server.is_medal) {
							const sub = subscriptions.find((s) => s.metadata?.id === server.server_id)
							if (sub) {
								server.medal_expires = new Date(
									new Date(sub.created).getTime() + 5 * 86400000,
								).toISOString()
							}
						}
					}
				}
				return response
			},
			staleTime: 30_000,
		})
		queryClient.prefetchQuery({
			queryKey: ['billing', 'subscriptions'],
			queryFn: () => tauriApiClient.labrinth.billing_internal.getSubscriptions(),
			staleTime: 30_000,
		})
		queryClient.prefetchQuery({
			queryKey: ['billing', 'payments'],
			queryFn: () => tauriApiClient.labrinth.billing_internal.getPayments(),
			staleTime: 30_000,
		})
	}
})

const error = useError()
const errorModal = ref()
const minecraftAuthErrorModal = ref()

const contentInstall = createContentInstall({ router, handleError })
provideContentInstall(contentInstall)
const {
	instances: contentInstallInstances,
	compatibleLoaders: contentInstallLoaders,
	gameVersions: contentInstallGameVersions,
	loading: contentInstallLoading,
	defaultTab: contentInstallDefaultTab,
	preferredLoader: contentInstallPreferredLoader,
	preferredGameVersion: contentInstallPreferredGameVersion,
	releaseGameVersions: contentInstallReleaseGameVersions,
	projectInfo: contentInstallProjectInfo,
	handleInstallToInstance,
	handleCreateAndInstall,
	handleNavigate: handleContentInstallNavigate,
	handleCancel: handleContentInstallCancel,
	setContentInstallModal,
	setModpackAlreadyInstalledModal: setContentInstallModpackAlreadyInstalledModal,
	handleModpackDuplicateCreateAnyway: handleContentInstallModpackDuplicateCreateAnyway,
	handleModpackDuplicateGoToInstance: handleContentInstallModpackDuplicateGoToInstance,
	setIncompatibilityWarningModal: setContentIncompatibilityWarningModal,
	incompatibilityWarningVersions: contentInstallIncompatibilityWarningVersions,
	incompatibilityWarningCurrentGameVersion: contentInstallIncompatibilityWarningCurrentGameVersion,
	incompatibilityWarningCurrentLoader: contentInstallIncompatibilityWarningCurrentLoader,
	incompatibilityWarningProjectType: contentInstallIncompatibilityWarningProjectType,
	incompatibilityWarningProjectIconUrl: contentInstallIncompatibilityWarningProjectIconUrl,
	incompatibilityWarningProjectName: contentInstallIncompatibilityWarningProjectName,
	incompatibilityWarningMessage: contentInstallIncompatibilityWarningMessage,
	incompatibilityWarningInstalling: contentInstallIncompatibilityWarningInstalling,
	handleIncompatibilityWarningInstall: handleContentInstallIncompatibilityWarningInstall,
	handleIncompatibilityWarningCancel: handleContentInstallIncompatibilityWarningCancel,
} = contentInstall

const serverInstall = createServerInstall({ router, handleError, popupNotificationManager })
provideServerInstall(serverInstall)
const {
	setInstallToPlayModal: setServerInstallToPlayModal,
	setUpdateToPlayModal: setServerUpdateToPlayModal,
	setAddServerToInstanceModal: setServerAddServerToInstanceModal,
	playServerProject,
} = serverInstall

const modInstallModal = ref()
const modpackAlreadyInstalledModal = ref()
const contentInstallModpackAlreadyInstalledModal = ref()
const addServerToInstanceModal = ref()
const incompatibilityWarningModal = ref()
const installToPlayModal = ref()
const updateToPlayModal = ref()

watch(incompatibilityWarningModal, (modal) => {
	if (modal) {
		setContentIncompatibilityWarningModal(modal)
	}
})

setupAuthProvider(credentials, async (_redirectPath) => {
	await signIn()
})

async function signIn() {
	await discord.login()
}

// This code line modified by Lumina Launcher
const hasPlus = computed(() => !!credentials.value?.user)

// Shown above the dock next to the sign-in button: a clear explanation when
// Discord OAuth isn't configured in this build, or the last login error.
const discordSignInMessage = computed(() => {
	if (!discord.isDiscordConfigured) {
		return formatMessage(messages.discordNotConfigured)
	}
	return discord.errorMessage
})

async function fetchIntercomToken() {
	const creds = null
	if (!creds?.session) {
		throw new Error('Not authenticated')
	}

	const params = new URLSearchParams()
	const rawServerId = route.params.id
	const serverId = Array.isArray(rawServerId) ? rawServerId[0] : rawServerId
	if (route.path.startsWith('/hosting/manage/') && typeof serverId === 'string') {
		params.set('server_id', serverId)
	}
	const query = params.size > 0 ? `?${params.toString()}` : ''

	const response = await tauriFetch(`${config.siteUrl}/api/intercom/messenger-jwt${query}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${creds.session}`,
		},
	})
	if (!response.ok) {
		throw new Error(`Failed to fetch Intercom token: ${response.status}`)
	}
	return await response.json()
}

onMounted(() => {
	invoke('show_window')
	window.addEventListener('resize', updateDockIndicator)

	error.setErrorModal(errorModal.value)
	error.setMinecraftAuthErrorModal(minecraftAuthErrorModal.value)

	setContentIncompatibilityWarningModal(incompatibilityWarningModal.value)
	setContentInstallModal(modInstallModal.value)
	setContentInstallModpackAlreadyInstalledModal(contentInstallModpackAlreadyInstalledModal.value)
	setModpackAlreadyInstalledModal(modpackAlreadyInstalledModal.value)
	setServerAddServerToInstanceModal(addServerToInstanceModal.value)
	setServerInstallToPlayModal(installToPlayModal.value)
	setServerUpdateToPlayModal(updateToPlayModal.value)
})

const accounts = ref(null)
provide('accountsCard', accounts)

command_listener(handleCommand)
notification_listener(handleLiveNotification)

async function markLiveNotificationRead(notification) {
	try {
		await tauriApiClient.labrinth.notifications_v2.markAsRead(notification.id)
	} catch (error) {
		if (error instanceof ModrinthApiError && error.statusCode === 404) {
			console.warn(`notification ${notification.id} could not be marked as read`, error)
			return
		}
		throw error
	}
}

async function respondToServerInvite(notification, action) {
	const serverId = notification.body?.server_id
	if (typeof serverId !== 'string') {
		throw new Error('Missing server ID for invite notification.')
	}

	await tauriApiClient.request(`/servers/${serverId}/invites/${action}`, {
		api: 'archon',
		version: 1,
		method: 'POST',
	})
	await markLiveNotificationRead(notification)

	return serverId
}

async function acceptServerInviteNotification(notification) {
	try {
		const serverId = await respondToServerInvite(notification, 'accept')
		await router.push(`/hosting/manage/${encodeURIComponent(serverId)}`)
		queryClient.invalidateQueries({ queryKey: ['servers'] })
	} catch (error) {
		handleError(error)
	}
}

async function declineServerInviteNotification(notification) {
	try {
		await respondToServerInvite(notification, 'decline')
	} catch (error) {
		handleError(error)
	}
}

function openServerInviteInviterProfile(inviterName) {
	if (!inviterName) return
	openUrl(`${config.siteUrl}/user/${encodeURIComponent(inviterName)}`)
}

async function handleLiveNotification(notification) {
	if (notification?.body?.type !== 'server_invite' || notification.read) return
	if (displayedServerInviteNotifications.has(notification.id)) return

	displayedServerInviteNotifications.add(notification.id)

	const serverName =
		typeof notification.body.server_name === 'string' ? notification.body.server_name : 'a server'
	const inviterId = notification.body.invited_by
	const invitedBy =
		typeof inviterId === 'string' ? await get_user(inviterId, 'bypass').catch(() => null) : null

	addPopupNotification({
		title: serverName,
		autoCloseMs: null,
		toast: {
			type: 'server-invite',
			actorName: invitedBy?.username ?? null,
			actorAvatarUrl: invitedBy?.avatar_url ?? null,
			entityName: serverName,
			onAccept: () => acceptServerInviteNotification(notification),
			onDecline: () => declineServerInviteNotification(notification),
			onOpenActor: () => openServerInviteInviterProfile(invitedBy?.username ?? null),
		},
	})
}

async function handleCommand(e) {
	if (!e) return

	if (e.event === 'RunMRPack') {
		// RunMRPack should directly install a local mrpack given a path
		if (e.path.endsWith('.mrpack')) {
			await create_profile_and_install_from_file(e.path, (createProfile, fileName) =>
				unknownPackWarningModal.value?.show(createProfile, fileName),
			).catch(handleError)
		}
	} else if (e.event === 'InstallServer') {
		await router.push(`/project/${e.id}`)
		await playServerProject(e.id).catch(handleError)
	} else if (e.event === 'InstallVersion') {
		const version = await get_version(e.id, 'must_revalidate').catch(handleError)
		if (version) {
			await contentInstall
				.install(version.project_id, version.id, null, 'URLConfirmModal', undefined, undefined, {
					showProjectInfo: true,
				})
				.catch(handleError)
		}
	} else {
		await contentInstall
			.install(e.id, null, null, 'URLConfirmModal', undefined, undefined, { showProjectInfo: true })
			.catch(handleError)
	}
}

const appUpdateDownload = {
	progress: ref(0),
	version: ref(),
}

async function openModrinthProjectLinkInApp(parsed) {
	const { slug, pathSuffix, url } = parsed
	const loadToken = loading.begin()
	try {
		const { id } = await tauriApiClient.labrinth.projects_v2.check(slug)
		const query = mergeUrlQuery(route.query, url)
		await router.push({
			path: `/project/${id}${pathSuffix}`,
			query,
			hash: url.hash || undefined,
		})
	} catch (err) {
		if (err instanceof ModrinthApiError && err.statusCode === 404) {
			openUrl(url.href)
		} else {
			handleError(err)
		}
	} finally {
		loading.end(loadToken)
	}
}

function handleClick(e) {
	let target = e.target
	while (target != null) {
		if (target.matches('a')) {
			if (
				target.href &&
				['http://', 'https://', 'mailto:', 'tel:'].some((v) => target.href.startsWith(v)) &&
				!target.classList.contains('router-link-active') &&
				!target.href.startsWith('http://localhost') &&
				!target.href.startsWith('https://tauri.localhost') &&
				!target.href.startsWith('http://tauri.localhost')
			) {
				const parsed = parseModrinthLink(target.href)
				if (target.target !== '_blank' && parsed) {
					void openModrinthProjectLinkInApp(parsed)
				} else {
					openUrl(target.href)
				}
			}
			e.preventDefault()
			break
		}
		target = target.parentElement
	}
}

function handleAuxClick(e) {
	// disables middle click -> new tab
	if (e.button === 1) {
		e.preventDefault()
		// instead do a left click
		const event = new MouseEvent('click', {
			view: window,
			bubbles: true,
			cancelable: true,
		})
		e.target.dispatchEvent(event)
	}
}

function cleanupOldSurveyDisplayData() {
	const threeWeeksAgo = new Date()
	threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i)

		if (key.startsWith('survey-') && key.endsWith('-display')) {
			const dateValue = new Date(localStorage.getItem(key))
			if (dateValue < threeWeeksAgo) {
				localStorage.removeItem(key)
			}
		}
	}
}

async function openSurvey() {
	if (!availableSurvey.value) {
		console.error('No survey to open')
		return
	}

	const creds = null
	const userId = creds?.user_id

	const formId = availableSurvey.value.tally_id

	const popupOptions = {
		layout: 'modal',
		width: 700,
		autoClose: 2000,
		hideTitle: true,
		hiddenFields: {
			user_id: userId,
		},
		onOpen: () => console.info('Opened user survey'),
		onClose: () => {
			console.info('Closed user survey')
		},
		onSubmit: () => console.info('Active user survey submitted'),
	}

	try {
		if (window.Tally?.openPopup) {
			console.info(`Opening Tally popup for user survey (form ID: ${formId})`)
			dismissSurvey()
			window.Tally.openPopup(formId, popupOptions)
		} else {
			console.warn('Tally script not yet loaded')
		}
	} catch (e) {
		console.error('Error opening Tally popup:', e)
	}

	console.info(`Found user survey to show with tally_id: ${formId}`)
	window.Tally.openPopup(formId, popupOptions)
}

function dismissSurvey() {
	localStorage.setItem(`survey-${availableSurvey.value.id}-display`, new Date())
	availableSurvey.value = undefined
}

async function processPendingSurveys() {
	function isWithinLastTwoWeeks(date) {
		const twoWeeksAgo = new Date()
		twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
		return date >= twoWeeksAgo
	}

	cleanupOldSurveyDisplayData()

	const creds = null
	const userId = creds?.user_id

	const instances = await list().catch(handleError)
	const isActivePlayer =
		instances.findIndex(
			(instance) =>
				isWithinLastTwoWeeks(instance.last_played) && !isWithinLastTwoWeeks(instance.created),
		) >= 0

	let surveys = []
	try {
		surveys = await $fetch('https://api.modrinth.com/v2/surveys')
	} catch (e) {
		console.error('Error fetching surveys:', e)
	}

	const surveyToShow = surveys.find(
		(survey) =>
			!!(
				localStorage.getItem(`survey-${survey.id}-display`) === null &&
				survey.type === 'tally_app' &&
				((survey.condition === 'active_player' && isActivePlayer) ||
					(survey.assigned_users?.includes(userId) && !survey.dismissed_users?.includes(userId)))
			),
	)

	if (surveyToShow) {
		availableSurvey.value = surveyToShow
	} else {
		console.info('No user survey to show')
	}
}

// This code line modified by Lumina Launcher
provideAppUpdateDownloadProgress(appUpdateDownload) // [AR Note] If delete this shit line -> SettingsModal will not work.
</script>

<template>
	<SplashScreen v-if="!stateFailed" ref="splashScreen" data-tauri-drag-region />
	<div id="teleports"></div>
	<div v-if="debugErrors.length" class="debug-error-overlay">
		<div class="debug-error-title">Runtime errors ({{ debugErrors.length }})</div>
		<div v-for="(err, index) in debugErrors" :key="index" class="debug-error-line">
			{{ err }}
		</div>
	</div>
	<div
		v-if="stateInitialized"
		class="app-grid-layout relative"
		:class="{ 'disable-advanced-rendering': !themeStore.advancedRendering }"
	>
		<Suspense>
			<AppSettingsModal ref="settingsModal" />
		</Suspense>
		<CreationFlowModal
			ref="installationModal"
			type="instance"
			show-snapshot-toggle
			:fetch-existing-instance-names="fetchExistingInstanceNames"
			:search-modpacks="searchModpacks"
			:get-project-versions="getProjectVersions"
			:get-loader-manifest="getLoaderManifest"
			@create="handleCreate"
			@browse-modpacks="handleBrowseModpacks"
		/>
		<UnknownPackWarningModal ref="unknownPackWarningModal" />
		<div class="app-grid-navbar" role="navigation" aria-label="Primary">
			<div ref="dockNavCluster" class="dock-cluster dock-cluster-primary">
				<div ref="dockActiveIndicator" class="dock-active-indicator" aria-hidden="true"></div>
				<NavButton v-tooltip.top="'Home'" to="/">
					<HomeIcon />
				</NavButton>
				<NavButton v-if="themeStore.featureFlags.worlds_tab" v-tooltip.top="'Worlds'" to="/worlds">
					<WorldIcon />
				</NavButton>
				<NavButton
					v-tooltip.top="'Discover content'"
					to="/browse/modpack"
					:is-primary="() => route.path.startsWith('/browse') && !route.query.i"
					:is-subpage="(route) => route.path.startsWith('/project') && !route.query.i"
				>
					<CompassIcon />
				</NavButton>
				<NavButton v-tooltip.top="'Skin selector'" to="/skins">
					<ChangeSkinIcon />
				</NavButton>
				<NavButton
					v-tooltip.top="'Library'"
					to="/library"
					:is-primary="(r) => r.path === '/library' || r.path === '/library'"
					:is-subpage="
						() =>
							route.path.startsWith('/instance') ||
							route.path.startsWith('/library/') ||
							((route.path.startsWith('/browse') || route.path.startsWith('/project')) &&
								route.query.i)
					"
				>
					<LibraryIcon />
				</NavButton>
				<NavButton
					v-tooltip.top="'Hosting'"
					to="/hosting"
					:is-primary="
						(r) =>
							r.path === '/hosting' || r.path === '/hosting/manage' || r.path === '/hosting/manage/'
					"
					:is-subpage="
						(r) => r.path.startsWith('/hosting/manage/') && r.path !== '/hosting/manage/'
					"
				>
					<ServerStackIcon />
				</NavButton>
			</div>
			<div class="nav-section-divider" aria-hidden="true"></div>
			<div class="dock-cluster dock-cluster-secondary">
				<suspense>
					<QuickInstanceSwitcher />
				</suspense>
				<NavButton
					v-tooltip.top="'Create new instance'"
					:to="() => installationModal?.show()"
					:disabled="offline"
				>
					<PlusIcon />
				</NavButton>
				<!-- This code line modified by Lumina Launcher -->
				<template v-if="updater.isUpdateAvailable">
					<NavButton
						v-tooltip.top="formatMessage(commonMessages.settingsLabel)"
						class="dock-update-pulse"
						:to="() => $refs.settingsModal.show()"
					>
						<SettingsIcon />
					</NavButton>
				</template>
				<template v-else>
					<NavButton
						v-tooltip.top="formatMessage(commonMessages.settingsLabel)"
						:to="() => $refs.settingsModal.show()"
					>
						<SettingsIcon />
					</NavButton>
				</template>
				<OverflowMenu
					v-if="discord.isAuthorized"
					v-tooltip.top="`Discord account`"
					class="nav-account-button"
					:options="[
						{
							id: 'view-profile',
							action: () => discord.openProfile(),
						},
						{
							id: 'sign-out',
							action: () => discord.logout(),
							color: 'danger',
						},
					]"
					placement="top-end"
				>
					<Avatar :src="discord.avatarUrl(32) ?? ''" alt="" size="32px" circle />
					<template #view-profile>
						<UserIcon />
						<span class="inline-flex items-center gap-1">
							Signed in as
							<span class="inline-flex items-center gap-1 text-contrast font-semibold">
								<Avatar :src="discord.avatarUrl(20) ?? ''" alt="" size="20px" circle />
								{{ discord.username }}
							</span>
						</span>
						<ExternalIcon />
					</template>
					<template #sign-out> <LogOutIcon /> Sign out </template>
				</OverflowMenu>
				<NavButton
					v-else
					v-tooltip.top="'Sign in with Discord'"
					:to="() => signIn()"
					:disabled="discord.isLoggingIn"
				>
					<SpinnerIcon v-if="discord.isLoggingIn" class="size-5 animate-spin text-brand" />
					<LogInIcon v-else class="text-brand" />
				</NavButton>
			</div>
		</div>
		<!-- Floating notice for the Discord sign-in button (e.g. "not configured in this build") -->
		<Transition name="lumina-dock-alert">
			<div v-if="discordSignInMessage" class="dock-discord-alert" role="status">
				<CircleAlertIcon class="size-4 shrink-0" />
				<span>{{ discordSignInMessage }}</span>
			</div>
		</Transition>
		<div data-tauri-drag-region class="app-grid-statusbar bg-bg-raised h-[--top-bar-height] flex">
			<div data-tauri-drag-region class="flex min-w-0 flex-1 overflow-hidden p-3">
				<!-- This code line modified by Lumina Launcher -->
				<!-- <ModrinthAppLogo class="h-full w-auto shrink-0 text-contrast pointer-events-none" /> -->
				<div data-tauri-drag-region class="flex shrink-0 items-center gap-1 ml-3">
					<button
						class="cursor-pointer p-0 m-0 text-contrast border-none outline-none bg-button-bg rounded-full flex items-center justify-center w-6 h-6 hover:brightness-75 transition-all"
						@click="router.back()"
					>
						<LeftArrowIcon />
					</button>
					<button
						class="cursor-pointer p-0 m-0 text-contrast border-none outline-none bg-button-bg rounded-full flex items-center justify-center w-6 h-6 hover:brightness-75 transition-all"
						@click="router.forward()"
					>
						<RightArrowIcon />
					</button>
				</div>
				<Breadcrumbs class="pt-[2px]" />
			</div>
			<section data-tauri-drag-region class="flex shrink-0 ml-auto items-center">
				<ButtonStyled
					v-if="!forceSidebar && themeStore.toggleSidebar"
					:type="sidebarToggled ? 'standard' : 'transparent'"
					circular
				>
					<button
						class="mr-3 transition-transform"
						:class="{ 'rotate-180': !sidebarToggled }"
						@click="sidebarToggled = !sidebarToggled"
					>
						<RightArrowIcon />
					</button>
				</ButtonStyled>
				<div class="flex mr-3">
					<Suspense>
						<AppActionBar />
					</Suspense>
				</div>
				<WindowControls />
			</section>
		</div>
	</div>
	<div
		v-if="stateInitialized"
		class="app-contents"
		:class="{
			'sidebar-enabled': sidebarVisible,
			'disable-advanced-rendering': !themeStore.advancedRendering,
		}"
	>
		<div class="app-viewport flex-grow router-view">
			<transition name="popup-survey">
				<div
					v-if="availableSurvey"
					class="w-[400px] z-20 fixed -bottom-12 pb-16 right-[--right-bar-width] mr-4 rounded-t-2xl card-shadow bg-bg-raised border-surface-5 border-[1px] border-solid border-b-0 p-4"
				>
					<h2 class="text-lg font-extrabold mt-0 mb-2">Hey there Lumina user!</h2>
					<p class="m-0 leading-tight">
						Would you mind answering a few questions about your experience with Lumina Launcher?
					</p>
					<p class="mt-3 mb-4 leading-tight">
						This feedback will go directly to the Lumina team and help guide future updates!
					</p>
					<div class="flex gap-2">
						<ButtonStyled color="brand">
							<button @click="openSurvey"><NotepadTextIcon /> Take survey</button>
						</ButtonStyled>
						<ButtonStyled>
							<button @click="dismissSurvey"><XIcon /> No thanks</button>
						</ButtonStyled>
					</div>
				</div>
			</transition>
			<div
				v-if="loading.pending.value && !suspensePending"
				class="loading-indicator-container absolute z-50 pointer-events-none"
				:style="{
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
				}"
			>
				<LoadingIndicator />
			</div>
			<div
				v-if="themeStore.featureFlags.page_path"
				class="absolute bottom-0 left-0 m-2 bg-tooltip-bg text-tooltip-text font-semibold rounded-full px-2 py-1 text-xs z-50"
			>
				{{ route.fullPath }}
			</div>
			<div
				id="background-teleport-target"
				class="absolute h-full -z-10 rounded-tl-[--radius-xl] overflow-hidden"
				:style="{
					width: 'calc(100% - var(--right-bar-width))',
				}"
			></div>
			<Admonition
				v-if="authUnreachable"
				type="warning"
				:header="formatMessage(messages.authUnreachableHeader)"
				class="m-6 mb-0"
			>
				{{ formatMessage(messages.authUnreachableBody) }}
			</Admonition>
			<RouterView v-slot="{ Component }">
				<template v-if="Component">
					<Transition :css="!cardExpandActive" name="page">
						<Suspense :key="route.path" @pending="onSuspensePending" @resolve="onSuspenseResolve">
							<component :is="Component"></component>
							<!-- Never leave the viewport empty while an async page loads:
							   that empty state is the "black screen" users hit when
							   clicking between pages faster than they resolve. -->
							<template #fallback>
								<div class="loading-indicator-container page-suspense-fallback">
									<LoadingIndicator />
								</div>
							</template>
						</Suspense>
					</Transition>
				</template>
			</RouterView>
		</div>
		<div
			class="app-sidebar mt-px shrink-0 flex flex-col overflow-hidden"
			:class="{ 'has-plus': hasPlus }"
		>
			<div
				v-overlay-scrollbars="sidebarOverlayScrollbarsOptions"
				class="app-sidebar-scrollable flex-grow shrink relative"
				:class="{ 'pb-12': !hasPlus }"
				data-overlayscrollbars-initialize
			>
				<div id="sidebar-teleport-target" class="sidebar-teleport-content"></div>
				<div class="sidebar-default-content" :class="{ 'sidebar-enabled': sidebarVisible }">
					<div class="p-4 border-0 border-b-[1px] border-[--brand-gradient-border] border-solid">
						<h3 class="text-base text-primary font-medium m-0">Playing as</h3>
						<suspense>
							<AccountsCard ref="accounts" />
						</suspense>
					</div>
					<div class="p-4 border-0 border-b-[1px] border-[--brand-gradient-border] border-solid">
						<suspense>
							<DiscordPanel />
						</suspense>
					</div>
				</div>
			</div>
		</div>
	</div>
	<I18nDebugPanel />
	<NotificationPanel :has-sidebar="sidebarVisible" />
	<PopupNotificationPanel :has-sidebar="sidebarVisible" />
	<UpdateToast />
	<ErrorModal ref="errorModal" />
	<MinecraftAuthErrorModal ref="minecraftAuthErrorModal" />
	<ContentInstallModal
		ref="modInstallModal"
		:instances="contentInstallInstances"
		:compatible-loaders="contentInstallLoaders"
		:game-versions="contentInstallGameVersions"
		:loading="contentInstallLoading"
		:default-tab="contentInstallDefaultTab"
		:preferred-loader="contentInstallPreferredLoader"
		:preferred-game-version="contentInstallPreferredGameVersion"
		:release-game-versions="contentInstallReleaseGameVersions"
		:project-info="contentInstallProjectInfo"
		@install="handleInstallToInstance"
		@create-and-install="handleCreateAndInstall"
		@navigate="handleContentInstallNavigate"
		@cancel="handleContentInstallCancel"
	/>
	<ModpackAlreadyInstalledModal
		ref="modpackAlreadyInstalledModal"
		@create-anyway="handleModpackDuplicateCreateAnyway"
		@go-to-instance="handleModpackDuplicateGoToInstance"
	/>
	<AddServerToInstanceModal ref="addServerToInstanceModal" />
	<ContentUpdaterModal
		ref="incompatibilityWarningModal"
		mode="incompatibility-warning"
		:versions="contentInstallIncompatibilityWarningVersions"
		:current-game-version="contentInstallIncompatibilityWarningCurrentGameVersion"
		:current-loader="contentInstallIncompatibilityWarningCurrentLoader"
		current-version-id=""
		:is-app="true"
		:project-type="contentInstallIncompatibilityWarningProjectType"
		:project-icon-url="contentInstallIncompatibilityWarningProjectIconUrl"
		:project-name="contentInstallIncompatibilityWarningProjectName"
		:warning="contentInstallIncompatibilityWarningMessage"
		:action-loading="contentInstallIncompatibilityWarningInstalling"
		@update="handleContentInstallIncompatibilityWarningInstall"
		@cancel="handleContentInstallIncompatibilityWarningCancel"
	/>
	<ModpackAlreadyInstalledModal
		ref="contentInstallModpackAlreadyInstalledModal"
		@create-anyway="handleContentInstallModpackDuplicateCreateAnyway"
		@go-to-instance="handleContentInstallModpackDuplicateGoToInstance"
	/>
	<InstallToPlayModal ref="installToPlayModal" />
	<UpdateToPlayModal ref="updateToPlayModal" />
</template>

<style lang="scss" scoped>
.app-grid-layout,
.app-contents {
	--top-bar-height: 3rem;
	--bottom-bar-height: 4.5rem;
	--right-bar-width: 300px;
}

.app-grid-layout {
	display: grid;
	grid-template: 'status' / 1fr;
	position: relative;
	background: #0d0c0b;
	height: 100vh;
}

.app-grid-navbar {
	/* Floating bottom dock — out of the grid flow, overlays the content */
	position: fixed;
	z-index: 60;
	bottom: 0.75rem;
	left: 0;
	right: 0;
	width: max-content;
	margin-inline: auto;

	display: flex;
	flex-direction: row;
	align-items: center;
	flex-wrap: nowrap;
	gap: 0.25rem;
	--dock-btn-size: 3rem;
	max-width: calc(100vw - 1rem);
	padding: calc((var(--bottom-bar-height) - var(--dock-btn-size)) / 2) 0.75rem;

	border-radius: 999px;
	/* Frosted glass: translucent charcoal so content blurs through behind the pill */
	background: rgba(13, 12, 11, 0.62);
	border: 1px solid rgba(255, 255, 255, 0.08);
	box-shadow:
		0 20px 48px rgba(0, 0, 0, 0.45),
		0 4px 12px rgba(0, 0, 0, 0.28);
	backdrop-filter: blur(28px) saturate(175%);
	-webkit-backdrop-filter: blur(28px) saturate(175%);

	animation: lumina-fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.dock-cluster {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}

.dock-cluster-primary {
	position: relative;
}

.dock-active-indicator {
	position: absolute;
	top: 0;
	left: 0;
	width: 0;
	height: 0;
	border-radius: 0.9rem;
	background: color-mix(in srgb, var(--color-brand) 20%, transparent);
	border: 1px solid color-mix(in srgb, var(--color-brand) 26%, transparent);
	opacity: 0;
	pointer-events: none;
	z-index: 0;
	/* Solid pill glides between icons — motion carries the cue, not light bloom */
	transition:
		left 280ms cubic-bezier(0.22, 1, 0.36, 1),
		top 280ms cubic-bezier(0.22, 1, 0.36, 1),
		width 280ms cubic-bezier(0.22, 1, 0.36, 1),
		height 280ms cubic-bezier(0.22, 1, 0.36, 1),
		opacity 200ms ease;
}

.dock-cluster-primary :deep(.nav-button-link) {
	position: relative;
	z-index: 1;
}

/* Primary cluster uses the sliding pill; per-button ::after pills would double up */
.dock-cluster-primary :deep(.nav-button-link)::after {
	display: none;
}

/* Floating notice hovering just above the dock, e.g. "Discord sign-in isn't
   configured in this build" — explains why the sign-in button can't work. */
.dock-discord-alert {
	position: fixed;
	z-index: 61;
	left: 50%;
	bottom: calc(var(--bottom-bar-height) + 1.5rem);
	transform: translateX(-50%);
	display: flex;
	align-items: center;
	gap: 0.5rem;
	max-width: min(90vw, 28rem);
	padding: 0.55rem 0.9rem;
	border-radius: 999px;
	background: rgba(16, 14, 12, 0.94);
	border: 1px solid color-mix(in srgb, var(--color-brand) 30%, transparent);
	box-shadow:
		0 16px 40px rgba(0, 0, 0, 0.45),
		inset 0 1px 0 color-mix(in srgb, var(--color-brand) 14%, transparent);
	backdrop-filter: blur(20px) saturate(150%);
	-webkit-backdrop-filter: blur(20px) saturate(150%);
	color: var(--color-text-default);
	font-size: 0.8rem;
	line-height: 1.35;
	text-align: center;
	pointer-events: none;
}

.dock-discord-alert svg {
	color: var(--color-brand);
}

.dock-discord-alert-enter-active {
	animation: lumina-fade-in-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.dock-discord-alert-leave-active {
	transition: opacity 0.15s ease;
}

.dock-discord-alert-leave-to {
	opacity: 0;
}

/* If backdrop blur isn't available, fall back to a near-solid pill so icons stay legible */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
	.app-grid-navbar {
		background: rgba(16, 14, 12, 0.94);
		border-color: rgba(255, 255, 255, 0.06);
	}
}

@media (prefers-reduced-motion: reduce) {
	.dock-active-indicator {
		transition: none;
	}

	.dock-update-pulse {
		animation: none;
	}
}

.nav-section-divider {
	width: 1px;
	height: calc(var(--dock-btn-size) * 0.85);
	margin: 0 0.5rem;
	background: color-mix(in srgb, var(--color-brand) 12%, transparent);
}

.nav-account-button {
	display: flex;
	align-items: center;
	justify-content: center;
	width: var(--dock-btn-size, 3rem);
	height: var(--dock-btn-size, 3rem);
	border: 1px solid transparent;
	border-radius: 0.9rem;
	background: transparent;
	color: var(--color-text-default);
	transition:
		transform 150ms ease,
		border-color 150ms ease;
}

.nav-account-button:hover {
	transform: scale(1.06);
	border-color: color-mix(in srgb, var(--color-brand) 22%, transparent);
}

@media (max-width: 1024px) {
	.app-grid-navbar {
		--dock-btn-size: 2.5rem;
		gap: 0.125rem;
		padding: calc((var(--bottom-bar-height) - var(--dock-btn-size)) / 2) 0.5rem;
	}

	.nav-section-divider {
		margin: 0 0.3rem;
	}
}

@media (max-width: 720px) {
	.app-grid-navbar {
		gap: 0;
		padding: calc((var(--bottom-bar-height) - var(--dock-btn-size)) / 2) 0.375rem;
	}

	.dock-cluster {
		gap: 0;
	}

	.nav-section-divider {
		margin: 0 0.2rem;
	}
}

.app-grid-statusbar {
	grid-area: status;
	padding-right: var(--window-controls-width, 0px);
	position: relative;
	z-index: 2;
}

/* Hairline under the drag bar so the draggable region reads as such */
.app-grid-statusbar::after {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 1px;
	background: rgba(255, 255, 255, 0.06);
	pointer-events: none;
}

[data-tauri-drag-region-exclude] {
	-webkit-app-region: no-drag;
}

.app-contents {
	position: absolute;
	z-index: 1;
	left: 0.5rem;
	top: calc(var(--top-bar-height) + 0.5rem);
	right: 0.5rem;
	bottom: 0.5rem;
	height: auto;
	border-radius: 1.125rem;
	border: 1px solid color-mix(in srgb, var(--color-brand) 16%, transparent);
	background: rgba(16, 14, 12, 0.97);
	box-shadow:
		0 0 0 1px rgba(255, 255, 255, 0.07),
		0 20px 50px rgba(0, 0, 0, 0.5);
	overflow: hidden;

	display: grid;
	grid-template-columns: 1fr 0px;
	grid-template-rows: 1fr;
	gap: 0.75rem;

	&.sidebar-enabled {
		grid-template-columns: 1fr 300px;
	}
}

.app-sidebar {
	overflow: hidden;
	width: 300px;
	position: relative;
	height: auto;
	margin: 0.5rem 0.5rem 0.5rem 0;
	background:
		linear-gradient(
			180deg,
			color-mix(in srgb, var(--color-brand) 10%, transparent) 0%,
			transparent 45%
		),
		linear-gradient(180deg, rgba(18, 16, 14, 0.92) 0%, rgba(10, 9, 8, 0.9) 100%);
	border-radius: 1.125rem;
	border: 1px solid color-mix(in srgb, var(--color-brand) 16%, transparent);
	border-right: 0;
	/* No backdrop-filter: the surface is ~92% opaque and a tall blurred layer
	   is a known WebView2 black-render trigger. */
	box-shadow:
		0 16px 44px rgba(0, 0, 0, 0.3),
		inset 0 1px 0 color-mix(in srgb, var(--color-brand) 12%, transparent);

	--color-button-bg: var(--brand-gradient-button);
	--color-button-bg-hover: var(--brand-gradient-border);
	--color-divider: var(--brand-gradient-border);
	--color-divider-dark: var(--brand-gradient-border);
}

.app-sidebar::after {
	position: absolute;
	bottom: 250px;
	left: 0;
	right: 0;
	height: 5rem;
	background: linear-gradient(
		to bottom,
		transparent,
		color-mix(in srgb, var(--color-brand) 10%, transparent)
	);
	pointer-events: none;
	border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}

.disable-advanced-rendering {
	.app-sidebar::before {
		box-shadow: none;
	}

	&.app-contents::before {
		box-shadow: none;
	}

	*,
	:deep(*) {
		box-shadow: none !important;
		--tw-drop-shadow:;
	}
}

.loading-indicator-container {
	display: flex;
	justify-content: center;
	align-items: center;
}

/* In-flow fallback shown inside the RouterView Suspense while an async page
   loads. Fills the full viewport height and centers the loader so the
   viewport is never an empty black region between pages. */
.page-suspense-fallback {
	min-height: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2rem;
	background: rgba(13, 12, 11, 0.5);
}

/* Compact the route-loading pill. The shell/card must be reached through the
   container: the `loading-indicator-inline` class lands on the child's root,
   which never carries this component's scoped attribute, so a descendant
   selector from it would never match. */
.loading-indicator-container :deep(.loading-indicator-shell) {
	width: auto;
	padding: 0;
}

.loading-indicator-container :deep(.loading-indicator-card) {
	padding: 0.6rem 0.8rem;
}

.app-viewport {
	position: relative;
	flex-grow: 1;
	height: 100%;
	overflow: auto;
	overflow-x: hidden;
	scrollbar-gutter: stable;
}

.app-contents::before {
	z-index: 0;
	content: '';
	position: absolute;
	inset: 0;
	border-radius: inherit;
	box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-brand) 10%, transparent);
}

.sidebar-default-content {
	display: none;
}

.sidebar-teleport-content:empty + .sidebar-default-content.sidebar-enabled {
	display: contents;
}

.popup-survey-enter-active {
	transition:
		opacity 0.25s ease,
		transform 0.25s cubic-bezier(0.51, 1.08, 0.35, 1.15);
	transform-origin: top center;
}

.popup-survey-leave-active {
	transition:
		opacity 0.25s ease,
		transform 0.25s cubic-bezier(0.68, -0.17, 0.23, 0.11);
	transform-origin: top center;
}

.popup-survey-enter-from,
.popup-survey-leave-to {
	opacity: 0;
	transform: translateY(10rem) scale(0.8) scaleY(1.6);
}

@media (prefers-reduced-motion: no-preference) {
	.nav-button-animated-enter-active {
		transition: all 0.5s cubic-bezier(0.15, 1.4, 0.64, 0.96);
	}

	.nav-button-animated-leave-active {
		transition: all 0.25s ease;
	}

	.nav-button-animated-enter-active {
		position: relative;
	}

	.nav-button-animated-enter-active::before {
		content: '';
		inset: 0;
		border-radius: 100vw;
		background-color: var(--color-brand-highlight);
		position: absolute;
		animation: pop 0.5s ease-in forwards;
		opacity: 0;
	}

	@keyframes pop {
		0% {
			scale: 0.5;
		}
		50% {
			opacity: 0.5;
		}
		100% {
			scale: 1.5;
		}
	}

	@keyframes lumina-fade-in-up {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes lumina-shimmer {
		0% {
			background-position: -200% center;
		}
		100% {
			background-position: 200% center;
		}
	}

	@keyframes lumina-pulse-breathe {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	.lumina-animate-in {
		animation: lumina-fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
		opacity: 0;
	}

	.dock-update-pulse {
		animation: lumina-pulse-breathe 2.5s ease-in-out infinite;
	}

	/* Route changes fade/slide in instead of cutting instantly */
	.page-enter-active {
		animation: lumina-fade-in-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.page-leave-active {
		transition: opacity 0.12s ease;
	}

	.page-leave-to {
		opacity: 0;
	}

	.nav-button-animated-enter-from {
		scale: 0.5;
		translate: -2rem 0;
		opacity: 0;
	}

	.nav-button-animated-leave-to {
		scale: 0.75;
		opacity: 0;
	}

	.fade-enter-active {
		transition: 0.25s ease-in-out;
	}

	.fade-enter-from {
		opacity: 0;
	}
}
</style>
<style>
.os-theme-dark,
.os-theme-light {
	--os-handle-bg: var(--color-scrollbar) !important;
	--os-handle-bg-hover: var(--color-scrollbar) !important;
	--os-handle-bg-active: var(--color-scrollbar) !important;
}

.mac {
	.app-grid-statusbar {
		padding-left: 5rem;
	}
}

.windows {
	.fake-appbar {
		height: 2.5rem !important;
	}

	.info-card {
		right: 22rem;
	}

	.profile-card {
		right: 8rem;
	}
}

/* Card-expand shared-element transition: keep the outgoing page pinned and
   only animate the element pair sharing a view-transition-name. These rules
   must live outside scoped styles — View Transition pseudo-elements attach to
   the document root, which never carries a scoped data attribute. */
::view-transition-old(root),
::view-transition-new(root) {
	animation: none;
}

::view-transition-old(partnered-server-banner) {
	animation: none;
}

::view-transition-new(partnered-server-banner) {
	animation: card-expand-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes card-expand-in {
	from {
		opacity: 0.35;
	}
	to {
		opacity: 1;
	}
}

.debug-error-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 99999999;
	max-height: 40vh;
	overflow: auto;
	background: rgba(0, 0, 0, 0.9);
	color: #ff6b6b;
	font-family: Consolas, monospace;
	font-size: 12px;
	padding: 10px 14px;
	border-bottom: 1px solid #ff6b6b;
	white-space: pre-wrap;
	word-break: break-word;
}

.debug-error-title {
	color: #fff;
	font-weight: bold;
	margin-bottom: 6px;
}

.debug-error-line {
	margin-bottom: 4px;
}
</style>
