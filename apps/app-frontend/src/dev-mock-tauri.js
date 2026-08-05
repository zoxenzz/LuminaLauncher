// TEMPORARY dev-only mock of the Tauri bridge so the frontend can be previewed
// in a plain browser (Chrome). DO NOT SHIP — remove before committing.
//
// Only activates when the real Tauri bridge is absent; inside the actual
// launcher webview this module is a no-op.

if (window.__TAURI_INTERNALS__) {
	// Real Tauri bridge present — do nothing.
} else {
	// Seed a mock Discord session so the sign-in gate does not block UI
	// interaction while previewing (network failures are tolerated by the
	// discord store and fall back to authorized).
	try {
		localStorage.setItem(
			'lumina-launcher.discord-session',
			JSON.stringify({
				token: { access_token: 'mock', token_type: 'Bearer', expires_in: 3600, scope: 'identify', refresh_token: null },
				user: { id: 'mock', username: 'Preview User', global_name: 'Preview User' },
				issuedAt: Date.now(),
			}),
		)
	} catch {
		/* ignore */
	}
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
					return '1.1.0-beta'
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
