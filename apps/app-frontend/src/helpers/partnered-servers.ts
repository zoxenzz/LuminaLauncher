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
		logoUrl: 'https://cdn.discordapp.com/attachments/1514290207955091556/1524424711982022707/image.png?ex=6a72a265&is=6a7150e5&hm=0e172e70b9e647e83b280dd75a8e2ea50aa0c4f4def377286e6512ea108b5126&',
		// Wide banner for the background (e.g. 1200x600, 2:1 ratio) - replace with the real image
		bannerUrl: 'https://cdn.discordapp.com/attachments/1384862235444383764/1534182851019280474/banner.png?ex=6a73329f&is=6a71e11f&hm=d22bbedf03831843fadcac2832ec9f7acc39fbce36931abe56374262412d0dce&',
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
		logoUrl: 'https://cdn.discordapp.com/attachments/1528637699500675102/1534179626341896242/server-icon.png?ex=6a732f9e&is=6a71de1e&hm=26ab4ccb12be67e5268a6450199c79494dc846df86af7df1b785a62349a70539&',
		// Wide banner for the background (e.g. 1200x600, 2:1 ratio) - replace with the real image
		bannerUrl: 'https://cdn.discordapp.com/attachments/1398336710118736034/1531312450178257019/quality_restoration_20260724152710796.jpg?ex=6a72a49a&is=6a71531a&hm=8f0c02ded625a522b2b8c6b898ca75df6fbff1d5196081e36ede69c772e061c4&',
		website: 'https://allay.tebex.io/',
	},

]
