import { defineStore } from 'pinia'

let systemThemeMq: MediaQueryList | null = null

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

export const THEME_OPTIONS = ['dark', 'light', 'oled', 'system'] as const

export const ACCENT_COLOR_STORAGE_KEY = 'lumina-launcher.accent-color'
export const DEFAULT_ACCENT_COLOR = '#f5b301'
export const ACCENT_OPTIONS = [
	{ name: 'Lumina Gold', value: '#f5b301' },
	{ name: 'Solar Amber', value: '#ffa726' },
	{ name: 'Emerald', value: '#34d399' },
	{ name: 'Sky Blue', value: '#38bdf8' },
	{ name: 'Royal Purple', value: '#a855f7' },
	{ name: 'Rose Pink', value: '#ec4899' },
	{ name: 'Flame Red', value: '#f43f5e' },
	{ name: 'Cyber Cyan', value: '#22d3ee' },
] as const

function hexToRgba(hex: string, alpha: number): string {
	const value = hex.replace('#', '')
	const full =
		value.length === 3
			? value
					.split('')
					.map((c) => c + c)
					.join('')
			: value
	const num = parseInt(full, 16)
	const r = (num >> 16) & 255
	const g = (num >> 8) & 255
	const b = num & 255
	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export type FeatureFlag = keyof typeof DEFAULT_FEATURE_FLAGS
export type FeatureFlags = Record<FeatureFlag, boolean>
export type ColorTheme = (typeof THEME_OPTIONS)[number]

export type ThemeStore = {
	selectedTheme: ColorTheme
	accentColor: string | null
	advancedRendering: boolean
	hideNametagSkinsPage: boolean
	toggleSidebar: boolean

	devMode: boolean
	featureFlags: FeatureFlags
}

export const DEFAULT_THEME_STORE: ThemeStore = {
	selectedTheme: 'dark',
	accentColor: null,
	advancedRendering: true,
	hideNametagSkinsPage: false,
	toggleSidebar: false,

	devMode: false,
	featureFlags: DEFAULT_FEATURE_FLAGS,
}

export const useTheming = defineStore('themeStore', {
	state: () => DEFAULT_THEME_STORE,
	actions: {
		setThemeState(newTheme: ColorTheme) {
			if (THEME_OPTIONS.includes(newTheme)) {
				this.selectedTheme = newTheme
			} else {
				console.warn('Selected theme is not present. Check themeOptions.')
			}

			this.setThemeClass()
		},
		setThemeClass() {
			const html = document.getElementsByTagName('html')[0]
			for (const theme of THEME_OPTIONS) {
				html.classList.remove(`${theme}-mode`)
			}

			systemThemeMq?.removeEventListener('change', this.setThemeClass)
			systemThemeMq = null

			let theme = this.selectedTheme
			if (this.selectedTheme === 'system') {
				systemThemeMq = window.matchMedia('(prefers-color-scheme: dark)')
				systemThemeMq.addEventListener('change', this.setThemeClass)
				theme = systemThemeMq.matches ? 'dark' : 'light'
			}

			html.classList.add(`${theme}-mode`)
		},
		setAccentColor(color: string) {
			this.accentColor = color
			this.applyAccentColor()
			window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, color)
		},
		initAccentColor() {
			const saved = window.localStorage.getItem(ACCENT_COLOR_STORAGE_KEY)
			if (saved) {
				this.accentColor = saved
				this.applyAccentColor()
			}
		},
		applyAccentColor() {
			if (!this.accentColor) return
			const html = document.getElementsByTagName('html')[0]
			html.style.setProperty('--color-brand', this.accentColor)
			html.style.setProperty('--color-brand-highlight', hexToRgba(this.accentColor, 0.25))
			html.style.setProperty('--color-brand-shadow', hexToRgba(this.accentColor, 0.7))
		},
		getFeatureFlag(key: FeatureFlag) {
			return this.featureFlags[key] ?? DEFAULT_FEATURE_FLAGS[key]
		},
		getThemeOptions() {
			return THEME_OPTIONS
		},
	},
})
