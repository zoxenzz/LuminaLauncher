export type PartneredServer = {
	id: string
	name: string
	tagline: string
	tag: string
	address: string
	networkName: string
	/** Square profile-style logo shown as the avatar/icon for the server. */
	logoUrl: string
	/** Wide banner image (≈2:1) used as the full background on the card and the info page. */
	bannerUrl: string
	website?: string
}

export const PARTNERED_SERVERS: PartneredServer[] = [
	{
		id: 'lumina',
		name: 'Lumina Forge',
		tagline: 'The featured community server',
		tag: 'Featured',
		address: 'lumina.corehost.store',
		networkName: 'LuminaForge',
		// Square logo for the avatar (e.g. 96x96+)
		logoUrl: 'https://i.imgur.com/XC4bG0k.png',
		// Wide banner for the background (e.g. 1200x600, 2:1 ratio) - replace with the real image
		bannerUrl: 'https://i.imgur.com/j9mbIjX.png',
		website: 'https://cubetypes.net',
	},
	{
		id: 'allay',
		name: 'Allay SMP',
		tagline: 'The featured community server',
		tag: 'Featured',
		address: 'allaysmp.pro',
		networkName: 'allaysmp',
		// Square logo for the avatar (e.g. 96x96+)
		logoUrl: 'https://i.imgur.com/yp7x3Ds.png',
		// Wide banner for the background (e.g. 1200x600, 2:1 ratio) - replace with the real image
		bannerUrl: 'https://i.imgur.com/l4t7YW6.png',
		website: 'https://allay.tebex.io/',
	},

]
