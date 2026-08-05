import { defineStore } from 'pinia'

export const DEFAULT_FEATURE_FLAGS = {
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
}

export type FeatureFlag = keyof typeof DEFAULT_FEATURE_FLAGS
export type FeatureFlags = Record<FeatureFlag, boolean>

// Lumina Launcher is dark-only and locked to the gold brand accent — themes
// are not supported, so this is a single-value type kept for settings compat.
export type ColorTheme = 'dark'

export type ThemeStore = {
	advancedRendering: boolean
	hideNametagSkinsPage: boolean
	toggleSidebar: boolean

	devMode: boolean
	featureFlags: FeatureFlags
}

export const DEFAULT_THEME_STORE: ThemeStore = {
	advancedRendering: true,
	hideNametagSkinsPage: false,
	toggleSidebar: false,

	devMode: false,
	featureFlags: DEFAULT_FEATURE_FLAGS,
}

export const useTheming = defineStore('themeStore', {
	state: () => DEFAULT_THEME_STORE,
	actions: {
		setThemeState() {
			const html = document.getElementsByTagName('html')[0]
			html.classList.add('dark-mode')
		},
		getFeatureFlag(key: FeatureFlag) {
			return this.featureFlags[key] ?? DEFAULT_FEATURE_FLAGS[key]
		},
	},
})
