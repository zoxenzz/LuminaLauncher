// TEMPORARY dev-only mock of the Tauri bridge so the frontend can be previewed
// in a plain browser (Chrome). DO NOT SHIP — remove before committing.
//
// Only activates when the real Tauri bridge is absent; inside the actual
// launcher webview this module is a no-op.

if (window.__TAURI_INTERNALS__) {
	// Real Tauri bridge present — do nothing.
} else {
	// No Discord session is seeded: the launcher is public, so previews start
	// unauthenticated and the dock shows the "Sign in with Discord" button.
	// `discord_login` below simulates the OAuth flow completing.
	const DEFAULT_SETTINGS = {
		max_concurrent_downloads: 4,
		max_concurrent_writes: 4,
		theme: 'dark',
		locale: 'en-US',
		default_page: 'home',
		collapsed_navigation: false,
		hide_nametag_skins_page: false,
		advanced_rendering: true,
		native_decorations: false,
		toggle_sidebar: false,
		telemetry: false,
		discord_rpc: false,
		personalized_ads: false,
		onboarded: true,
		extra_launch_args: [],
		custom_env_vars: [],
		memory: { maximum: 2048 },
		force_fullscreen: false,
		game_resolution: [1920, 1080],
		hide_on_process_start: false,
		hooks: {},
		custom_dir: null,
		prev_custom_dir: null,
		migrated: true,
		developer_mode: false,
		feature_flags: {
			project_background: false,
			page_path: false,
			worlds_tab: false,
			worlds_in_home: true,
			partnered_servers_home: true,
			server_project_qa: false,
			server_ram_as_bytes_always_on: false,
			always_show_app_controls: false,
			skip_unknown_pack_warning: false,
			pride_fundraiser: true,
			i18n_debug: false,
			show_instance_play_time: true,
		},
		skipped_update: null,
		pending_update_toast_for_version: null,
		auto_download_updates: false,
		version: 1,
	}

	const CALLBACKS = new Map()
	let callbackId = 0

	function transformCallback(callback) {
		callbackId += 1
		CALLBACKS.set(callbackId, callback)
		return callbackId
	}

	window.__TAURI_INTERNALS__ = {
		metadata: {
			currentWindow: { label: 'main' },
			currentWebview: { label: 'main' },
			currentWebviewWindow: { label: 'main' },
		},
		transformCallback,
		unregisterCallback: () => {},
		invoke: async (cmd, _args = {}) => {
			switch (cmd) {
				case 'plugin:app|version':
					return '1.2.0'
				case 'plugin:settings|settings_get':
					return DEFAULT_SETTINGS
				case 'plugin:settings|settings_set':
					return null
				case 'plugin:utils|get_os':
					return 'Windows'
				case 'plugin:utils|get_opening_command':
					return null
				case 'plugin:profile|profile_list':
					return []
				case 'plugin:profile|profile_get':
					return null
				case 'is_dev':
					return true
				case 'initialize_state':
					return null
				case 'show_window':
					return null
				case 'plugin:window|is_maximized':
					return false
				case 'plugin:window|set_decorations':
					return null
				case 'plugin:window|close':
				case 'plugin:window|minimize':
				case 'plugin:window|toggle_maximize':
					return null
				case 'updater_check':
					// ?mockUpdate=1 simulates a newer release so the toast's available
					// state can be previewed in a plain browser.
					if (new URLSearchParams(window.location.search).has('mockUpdate')) {
						return {
							status: {
								type: 'update_available',
								version: '1.2.2',
								notes: 'Mock release',
								size: 12345678,
							},
							release: {
								tag_name: 'release-1.2.2',
								name: 'Mock 1.2.2',
								body: 'Mock release notes',
								assets: [
									{
										id: 1,
										name: 'Lumina-Launcher-1.2.2-x64-setup.exe',
										url: 'https://api.github.com/repos/zoxenzz/LuminaLauncher/releases/assets/1',
										browserDownloadUrl:
											'https://github.com/zoxenzz/LuminaLauncher/releases/download/release-1.2.2/Lumina-Launcher-1.2.2-x64-setup.exe',
										contentType: 'application/x-msdownload',
										size: 12345678,
									},
								],
							},
						}
					}
					return { status: { type: 'up_to_date' }, release: null }
				case 'updater_download':
					return '/mock/updates/mock-installer'
				case 'updater_install':
					return null
				case 'plugin:discord-auth|discord_login':
					// Simulate a successful Discord OAuth so the dock's sign-in
					// button can be exercised in a plain browser.
					return {
						access_token: 'mock',
						token_type: 'Bearer',
						expires_in: 3600,
						scope: 'identify',
						refresh_token: null,
					}
				case 'plugin:event|listen':
				case 'plugin:window|on_resized':
				case 'plugin:window|on_moved':
				case 'plugin:window|on_close_requested':
					return async () => {}
				default:
					return null
			}
		},
		convertFileSrc: (path) => path,
	}

	window.__TAURI_OS_PLUGIN_INTERNALS__ = window.__TAURI_OS_PLUGIN_INTERNALS__ ?? {
		eol: '\n',
		platform: 'windows',
		version: '10.0.22631',
		family: 'windows',
		os_type: 'windows',
		arch: 'x86_64',
		exe_extension: 'exe',
		libc_os: 'unknown',
		libc_version: 'unknown',
	}
}
