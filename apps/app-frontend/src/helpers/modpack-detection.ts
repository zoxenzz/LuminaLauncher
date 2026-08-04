import type { Chat, ServerWorld } from '@/helpers/worlds'

export type ModpackRequirement = 'modpack' | 'vanilla' | 'unknown'

const MODPACK_INDICATORS = [
	/\bmodpack\b/i,
	/\bmodded\b/i,
	/client mods? required/i,
	/requires? (the |our )?mods?\b/i,
	/install (the |our |this )?modpack/i,
	/\b(fabric|forge|neoforge|quilt) (mods? )?(required|needed)/i,
	/(join|play)( only| with)? (with |using )?(the )?modpack/i,
]

const MODPACK_NAME_HINTS = [
	'fabulously optimized',
	'prominence',
	'cobblemon',
	'stoneblock',
	'all the mods',
	'atm10',
	'create above and beyond',
	'divine journey',
	'roguelike adventures',
]

export function flattenMotdText(raw: unknown): string {
	if (!raw) return ''
	if (typeof raw === 'string') return stripFormattingCodes(raw)
	if (typeof raw === 'object' && 'text' in raw) {
		const chat = raw as Chat
		let text = chat.text ?? ''
		for (const extra of chat.extra ?? []) {
			text += flattenMotdText(extra)
		}
		return stripFormattingCodes(text)
	}
	return ''
}

function stripFormattingCodes(text: string): string {
	return text
		.replace(/\u00a7./g, '')
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

export function detectModpackFromMotd(raw: unknown): ModpackRequirement {
	const text = flattenMotdText(raw)
	if (!text) return 'unknown'
	if (MODPACK_INDICATORS.some((indicator) => indicator.test(text))) return 'modpack'
	if (MODPACK_NAME_HINTS.some((hint) => text.toLowerCase().includes(hint))) return 'modpack'
	return 'vanilla'
}

export function detectServerModpackRequirement(
	world: ServerWorld,
	rawMotd?: unknown,
): ModpackRequirement {
	if (world.content_kind === 'modpack') return 'modpack'
	if (world.content_kind === 'vanilla') return 'vanilla'
	return detectModpackFromMotd(rawMotd)
}

export function canAutoInstallModpack(
	world: ServerWorld,
	requirement: ModpackRequirement,
): boolean {
	return requirement === 'modpack' && !!world.project_id
}
