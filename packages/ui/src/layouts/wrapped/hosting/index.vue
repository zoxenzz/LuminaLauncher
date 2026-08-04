<template>
	<div
		ref="scrollListener"
		data-pyro
		class="servers-hero relative isolate h-full min-h-screen pt-8"
	>
		<section
			class="mx-auto mt-32 flex min-h-[calc(80vh-0px)] max-w-7xl flex-col justify-center px-5 sm:mt-20 sm:min-h-[calc(100vh-0px)] sm:pl-10 lg:pl-3"
		>
			<div class="z-[5] flex w-full flex-col gap-8">
				<div class="flex flex-col gap-4">
					<div
						class="relative h-fit w-fit rounded-full bg-highlight-purple px-3 py-1 text-sm font-bold text-purple backdrop-blur-lg"
					>
						{{ formatMessage(messages.partnerBadge) }}
					</div>
					<h1 class="relative m-0 max-w-3xl text-3xl font-bold !leading-[110%] md:text-6xl">
						{{ formatMessage(messages.hostWithCoreHosting, { brand: coreHosting.brandName }) }}
					</h1>
				</div>
				<h2
					class="relative m-0 max-w-2xl text-base font-normal leading-[155%] text-secondary md:text-[1.2rem]"
				>
					<IntlFormatted
						:message-id="messages.hostingDescription"
						:values="{ brand: coreHosting.brandName }"
					>
						<template #contrast="{ children }">
							<span class="text-contrast"><component :is="() => children" /></span>
						</template>
					</IntlFormatted>
				</h2>
				<div class="relative flex w-full flex-wrap items-center gap-8 align-middle sm:w-fit">
					<div
						class="flex w-full flex-col items-center gap-5 text-center align-middle sm:w-fit sm:flex-row"
					>
						<ButtonStyled color="brand" size="large">
							<a
								class="w-fit"
								:href="coreHosting.siteUrl"
								target="_blank"
								rel="noopener noreferrer"
							>
								<GameIcon aria-hidden="true" />
								{{ formatMessage(messages.getStarted) }}
							</a>
						</ButtonStyled>
						<ButtonStyled type="outlined" size="large">
							<a
								class="w-fit"
								:href="coreHosting.discordUrl"
								target="_blank"
								rel="noopener noreferrer"
							>
								<BoxIcon aria-hidden="true" /> {{ formatMessage(messages.joinDiscord) }}
							</a>
						</ButtonStyled>
					</div>
				</div>
			</div>

			<div
				class="absolute left-[55%] top-56 z-[5] hidden h-full max-h-[calc(100vh-10rem)] w-full rotate-1 xl:block"
			>
				<img
					:src="coreHosting.images.heroPanel"
					alt=""
					aria-hidden="true"
					class="pointer-events-none h-full w-fit select-none"
				/>
			</div>

			<div
				class="top-26 pointer-events-none absolute left-0 z-[4] flex h-screen w-full flex-row items-end gap-24 sm:-right-1/4 sm:top-14"
			>
				<div
					class="pointer-events-none absolute left-0 right-0 top-8 max-h-[90%] overflow-hidden sm:top-28 sm:mt-0"
					style="mask-image: linear-gradient(black, transparent 80%)"
				>
					<img
						:src="coreHosting.images.heroBackground"
						alt=""
						aria-hidden="true"
						class="pointer-events-none w-full animate-spin select-none p-4 opacity-50"
						style="
							animation-duration: 172s !important;
							animation-timing-function: linear;
							animation-iteration-count: infinite;
						"
					/>
				</div>
			</div>
		</section>

		<section
			class="relative flex flex-col bg-[radial-gradient(65%_50%_at_50%_-10%,var(--color-purple-highlight)_0%,var(--color-accent-contrast)_100%)] px-3 pt-24 md:pt-48"
		>
			<div class="faded-brand-line absolute left-0 top-0 h-[1px] w-full"></div>
			<div class="relative mx-auto flex w-full max-w-7xl flex-col gap-8">
					<div
						class="relative w-fit rounded-full bg-highlight-purple px-3 py-1 text-sm font-bold text-purple backdrop-blur-lg"
					>
						{{ formatMessage(messages.whyCoreHosting) }}
					</div>
				<h1 class="relative m-0 max-w-2xl text-4xl leading-[120%] md:text-7xl">
					{{ formatMessage(messages.whyHeading) }}
				</h1>
				<h2
					class="relative m-0 max-w-2xl text-base font-normal leading-[155%] text-secondary md:text-[18px]"
				>
					{{ formatMessage(messages.whyDescription) }}
				</h2>
				<img
					:src="coreHosting.images.whyDecor"
					alt=""
					class="absolute right-14 top-0 hidden max-w-[360px] lg:block"
				/>
				<div class="relative grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
					<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="size-8 text-brand"
						>
							<path
								d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"
							/>
							<rect x="3" y="14" width="7" height="7" rx="1" />
							<circle cx="17.5" cy="17.5" r="3.5" />
						</svg>
						<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.powerfulHardware) }}</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							{{ formatMessage(messages.powerfulHardwareDescription) }}
						</h3>
					</div>

					<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<LoaderIcon loader="Fabric" class="size-8 text-brand" />
						<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.yourFavoriteMods) }}</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							{{ formatMessage(messages.yourFavoriteModsDescription) }}
						</h3>
					</div>
				</div>
				<div class="relative">
					<img
						:src="coreHosting.images.installation"
						alt=""
						class="hidden w-full rounded-2xl sm:block"
					/>
				</div>
				<div class="grid w-full grid-cols-1 gap-8 lg:grid-cols-3">
					<div class="flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<ShieldCheckIcon class="size-8 text-brand" />
						<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.ddosProtection) }}</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							{{ formatMessage(messages.ddosProtectionDescription) }}
						</h3>
					</div>

					<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="size-8 text-brand"
						>
							<polygon points="13 19 22 12 13 5 13 19" />
							<polygon points="2 19 11 12 2 5 2 19" />
						</svg>
						<h2 class="m-0 text-lg font-bold">
							{{ formatMessage(messages.modernReliableHosting) }}
						</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							<IntlFormatted
								:message-id="messages.modernReliableHostingDescription"
								:values="{ brand: coreHosting.brandName }"
							>
								<template #contrast="{ children }">
									<span class="text-contrast"><component :is="() => children" /></span>
								</template>
							</IntlFormatted>
						</h3>
					</div>

					<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<ServerIcon class="size-8 text-brand" />
						<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.consistentlyFast) }}</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							{{ formatMessage(messages.consistentlyFastDescription) }}
						</h3>
					</div>
				</div>
			</div>
		</section>

		<section
			class="relative mt-24 flex flex-col bg-[radial-gradient(65%_50%_at_50%_-10%,var(--color-purple-highlight)_0%,var(--color-accent-contrast)_100%)] px-3 pt-24 md:mt-48 md:pt-48"
		>
			<div class="faded-brand-line absolute left-0 top-0 h-[1px] w-full"></div>
			<div class="relative mx-auto flex w-full max-w-7xl flex-col gap-8">
					<div
						class="relative w-fit rounded-full bg-highlight-purple px-3 py-1 text-sm font-bold text-purple backdrop-blur-lg"
					>
						{{ formatMessage(messages.includedWithYourServer) }}
					</div>
				<h1 class="relative m-0 max-w-2xl text-4xl leading-[120%] md:text-7xl">
					{{ formatMessage(messages.includedHeading) }}
				</h1>
				<h2
					class="relative m-0 max-w-xl text-base font-normal leading-[155%] text-secondary md:text-[18px]"
				>
					<IntlFormatted
						:message-id="messages.includedDescription"
						:values="{ brand: coreHosting.brandName }"
					>
						<template #contrast="{ children }">
							<span class="text-contrast"><component :is="() => children" /></span>
						</template>
					</IntlFormatted>
				</h2>
				<img
					:src="coreHosting.images.featureDecor"
					alt=""
					class="absolute right-8 top-40 hidden max-w-[480px] lg:block"
				/>
				<div class="grid grid-cols-1 gap-9 lg:grid-cols-2">
					<div class="grid w-full grid-cols-1 gap-8">
						<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="size-8 text-brand"
							>
								<circle cx="12" cy="12" r="10" />
								<path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
								<path d="M2 12h20" />
							</svg>
							<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.customUrl) }}</h2>
							<h3 class="m-0 text-base font-normal text-secondary">
								{{ formatMessage(messages.customUrlDescription) }}
							</h3>
						</div>
						<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="size-8 text-brand"
							>
								<path d="M12 13v8" />
								<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
								<path d="m8 17 4-4 4 4" />
							</svg>
							<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.backupsIncluded) }}</h2>
							<h3 class="m-0 text-base font-normal text-secondary">
								{{ formatMessage(messages.backupsIncludedDescription) }}
							</h3>
						</div>
					</div>
					<div
						style="
							background: radial-gradient(
								86.12% 101.64% at 95.97% 94.07%,
								rgba(27, 217, 106, 0.23) 0%,
								rgba(14, 115, 56, 0.2) 100%
							);
							border: 1px solid rgba(12, 107, 52, 0.55);
							box-shadow: 0px 12px 38.1px rgba(27, 217, 106, 0.13);
						"
						class="relative flex flex-col gap-4 overflow-hidden rounded-2xl p-6 text-left sm:backdrop-blur-xl md:p-12"
					>
						<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.fileManager) }}</h2>
						<h3 class="m-0 text-base font-normal">
							{{ formatMessage(messages.fileManagerDescription) }}
						</h3>

						<img
							:src="coreHosting.images.fileManager"
							alt=""
							class="absolute -bottom-12 -right-[15%] hidden max-w-2xl rounded-2xl bg-brand p-4 lg:block"
						/>
					</div>
				</div>
				<div class="grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
					<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<TerminalSquareIcon class="size-8 text-brand" />
						<h2 class="m-0 text-lg font-bold">
							{{ formatMessage(messages.powerfulConsole) }}
						</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							{{ formatMessage(messages.powerfulConsoleDescription) }}
						</h3>
					</div>
					<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="size-8 text-brand"
						>
							<path
								d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
							/>
							<path
								d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"
							/>
							<path d="m18 15-2-2" />
							<path d="m15 18-2-2" />
						</svg>
						<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.support) }}</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							<IntlFormatted
								:message-id="messages.supportDescription"
								:values="{ brand: coreHosting.brandName }"
							>
								<template #contrast="{ children }">
									<span class="text-contrast"><component :is="() => children" /></span>
								</template>
							</IntlFormatted>
						</h3>
					</div>
				</div>

				<div class="grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
					<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<TransferIcon class="size-8 text-brand" />
						<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.sftpAccess) }}</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							{{ formatMessage(messages.sftpAccessDescription) }}
						</h3>
					</div>
					<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
						<VersionIcon class="size-8 text-brand" />
						<h2 class="m-0 text-lg font-bold">{{ formatMessage(messages.advancedNetworking) }}</h2>
						<h3 class="m-0 text-base font-normal text-secondary">
							{{ formatMessage(messages.advancedNetworkingDescription) }}
						</h3>
					</div>
				</div>
				<div class="relative flex flex-col gap-4 rounded-2xl bg-bg p-6 text-left md:p-12">
					<h1 class="m-0 text-lg font-bold">{{ formatMessage(messages.faqHeading) }}</h1>
					<div class="details-hide flex flex-col gap-1">
						<details nav-hash="hardware" class="group" :open="$route.hash === '#hardware'">
							<summary class="flex cursor-pointer items-center py-3 font-medium text-contrast">
								<span class="mr-2 transition-transform duration-200 group-open:rotate-90">
									<RightArrowIcon />
								</span>
								{{ formatMessage(messages.faqHardware) }}
							</summary>
							<p class="m-0 ml-6 leading-[160%]">
								{{ formatMessage(messages.faqHardwareAnswer) }}
							</p>
						</details>
						<details nav-hash="ddos" class="group" :open="$route.hash === '#ddos'">
							<summary class="flex cursor-pointer items-center py-3 font-medium text-contrast">
								<span class="mr-2 transition-transform duration-200 group-open:rotate-90">
									<RightArrowIcon />
								</span>
								{{ formatMessage(messages.faqDDOSProtection) }}
							</summary>
							<p class="m-0 ml-6 leading-[160%]">
								{{ formatMessage(messages.faqDDOSProtectionAnswer) }}
							</p>
						</details>
						<details nav-hash="region" class="group" :open="$route.hash === '#region'">
							<summary class="flex cursor-pointer items-center py-3 font-medium text-contrast">
								<span class="mr-2 transition-transform duration-200 group-open:rotate-90">
									<RightArrowIcon />
								</span>
								{{ formatMessage(messages.faqLocation) }}
							</summary>
							<p class="m-0 ml-6 leading-[160%]">
								{{ formatMessage(messages.faqLocationAnswer) }}
							</p>
						</details>
						<details nav-hash="upgrade" class="group" :open="$route.hash === '#upgrade'">
							<summary class="flex cursor-pointer items-center py-3 font-medium text-contrast">
								<span class="mr-2 transition-transform duration-200 group-open:rotate-90">
									<RightArrowIcon />
								</span>
								{{ formatMessage(messages.faqUpgrade) }}
							</summary>
							<p class="m-0 ml-6 leading-[160%]">
								{{ formatMessage(messages.faqUpgradeAnswer) }}
							</p>
						</details>
						<details nav-hash="performance" class="group" :open="$route.hash === '#performance'">
							<summary class="flex cursor-pointer items-center py-3 font-medium text-contrast">
								<span class="mr-2 transition-transform duration-200 group-open:rotate-90">
									<RightArrowIcon />
								</span>
								{{ formatMessage(messages.faqHowFast) }}
							</summary>
							<p class="m-0 ml-6 leading-[160%]">
								{{ formatMessage(messages.faqHowFastAnswer) }}
							</p>
						</details>
						<details nav-hash="versions" class="group" :open="$route.hash === '#versions'">
							<summary class="flex cursor-pointer items-center py-3 font-medium text-contrast">
								<span class="mr-2 transition-transform duration-200 group-open:rotate-90">
									<RightArrowIcon />
								</span>
								{{ formatMessage(messages.faqVersionsLoaders) }}
							</summary>
							<p class="m-0 ml-6 leading-[160%]">
								{{ formatMessage(messages.faqVersionsLoadersAnswer) }}
							</p>
						</details>
					</div>
				</div>
			</div>
		</section>

		<section
			class="relative mt-24 flex flex-col bg-[radial-gradient(65%_50%_at_50%_-10%,var(--color-purple-highlight)_0%,var(--color-accent-contrast)_100%)] px-3 pt-24 md:mt-48 md:pt-48"
		>
			<div class="faded-brand-line absolute left-0 top-0 h-[1px] w-full"></div>
			<div class="mx-auto flex w-full max-w-7xl flex-col items-center gap-8 pb-24 text-center">
				<h1 class="relative m-0 max-w-3xl text-4xl leading-[120%] md:text-7xl">
					{{ formatMessage(messages.readyToStart) }}
				</h1>
				<p
					class="relative m-0 max-w-xl text-base font-normal leading-[155%] text-secondary md:text-[18px]"
				>
					<IntlFormatted
						:message-id="messages.readyToStartDescription"
						:values="{ brand: coreHosting.brandName }"
					>
						<template #contrast="{ children }">
							<span class="text-contrast"><component :is="() => children" /></span>
						</template>
					</IntlFormatted>
				</p>
				<div
					class="flex w-full flex-col items-center gap-5 text-center align-middle sm:w-fit sm:flex-row"
				>
					<ButtonStyled color="brand" size="large">
						<a class="w-fit" :href="coreHosting.siteUrl" target="_blank" rel="noopener noreferrer">
							{{
								formatMessage(messages.getStartedWithCoreHosting, {
									brand: coreHosting.brandName,
								})
							}}
							<RightArrowIcon class="shrink-0" />
						</a>
					</ButtonStyled>
					<ButtonStyled type="outlined" size="large">
						<a
							class="w-fit"
							:href="coreHosting.discordUrl"
							target="_blank"
							rel="noopener noreferrer"
						>
							{{ formatMessage(messages.joinDiscord) }}
						</a>
					</ButtonStyled>
				</div>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import {
	BoxIcon,
	GameIcon,
	RightArrowIcon,
	ServerIcon,
	ShieldCheckIcon,
	TerminalSquareIcon,
	TransferIcon,
	VersionIcon,
} from '@modrinth/assets'
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

import ButtonStyled from '#ui/components/base/ButtonStyled.vue'
import IntlFormatted from '#ui/components/base/IntlFormatted.vue'
import LoaderIcon from '#ui/components/servers/icons/LoaderIcon.vue'
import { defineMessages, useVIntl } from '#ui/composables/i18n'

import { coreHosting } from './core-hosting'

const route = useRoute()

const { formatMessage } = useVIntl()

const messages = defineMessages({
	partnerBadge: {
		id: 'core-hosting-marketing.hero.partner-badge',
		defaultMessage: 'Partnered hosting',
	},
	hostWithCoreHosting: {
		id: 'core-hosting-marketing.hero.host-with-core-hosting',
		defaultMessage: 'Host your next server with {brand}',
	},
	hostingDescription: {
		id: 'core-hosting-marketing.hero.hosting-description',
		defaultMessage:
			'{brand} is the <contrast>partnered hosting provider</contrast> for this launcher. Get your Minecraft server online in minutes with high-performance hardware, DDoS protection, and one-click modpack installs.',
	},
	getStarted: {
		id: 'core-hosting-marketing.hero.button.get-started',
		defaultMessage: 'Get started',
	},
	joinDiscord: {
		id: 'core-hosting-marketing.hero.button.join-discord',
		defaultMessage: 'Join our Discord',
	},
	whyCoreHosting: {
		id: 'core-hosting-marketing.why.why-core-hosting',
		defaultMessage: 'Why Core Hosting?',
	},
	whyHeading: {
		id: 'core-hosting-marketing.why.heading',
		defaultMessage: 'A powerful home for your server',
	},
	whyDescription: {
		id: 'core-hosting-marketing.why.description',
		defaultMessage:
			'From your first world to your biggest modpack, Core Hosting has the hardware and support to keep you playing.',
	},
	powerfulHardware: {
		id: 'core-hosting-marketing.why.powerful-hardware',
		defaultMessage: 'High-performance hardware',
	},
	powerfulHardwareDescription: {
		id: 'core-hosting-marketing.why.powerful-hardware.description',
		defaultMessage:
			'Core Hosting runs on modern AMD CPUs with DDR5 memory, so your server always has the power it needs.',
	},
	yourFavoriteMods: {
		id: 'core-hosting-marketing.why.your-favorite-mods',
		defaultMessage: 'All your favorite mods',
	},
	yourFavoriteModsDescription: {
		id: 'core-hosting-marketing.why.your-favorite-mods.description',
		defaultMessage:
			'Choose between Vanilla, Fabric, Forge, Quilt, and NeoForge. If it runs on Modrinth, it can run on your server.',
	},
	ddosProtection: {
		id: 'core-hosting-marketing.why.ddos-protection',
		defaultMessage: 'DDoS protection included',
	},
	ddosProtectionDescription: {
		id: 'core-hosting-marketing.why.ddos-protection.description',
		defaultMessage:
			'Every server is protected against DDoS attacks with high-capacity mitigation, keeping your world online.',
	},
	modernReliableHosting: {
		id: 'core-hosting-marketing.why.modern-reliable-hosting',
		defaultMessage: 'Modern, reliable hosting',
	},
	modernReliableHostingDescription: {
		id: 'core-hosting-marketing.why.modern-reliable-hosting.description',
		defaultMessage:
			'{brand} runs on <contrast>custom-built software and never-overloaded nodes</contrast>, so your server stays smooth under load.',
	},
	consistentlyFast: {
		id: 'core-hosting-marketing.why.consistently-fast',
		defaultMessage: 'Consistently fast',
	},
	consistentlyFastDescription: {
		id: 'core-hosting-marketing.why.consistently-fast.description',
		defaultMessage:
			'Each server runs at its full performance with no neighbours slowing you down, no matter the time of day.',
	},
	includedWithYourServer: {
		id: 'core-hosting-marketing.included.with-your-server',
		defaultMessage: 'Included with your server',
	},
	includedHeading: {
		id: 'core-hosting-marketing.included.heading',
		defaultMessage: 'Comes with all the features you need.',
	},
	includedDescription: {
		id: 'core-hosting-marketing.included.description',
		defaultMessage:
			'Every server comes with a suite of features designed for a <contrast>hassle-free hosting experience</contrast>.',
	},
	customUrl: {
		id: 'core-hosting-marketing.included.custom-url',
		defaultMessage: 'Custom domain',
	},
	customUrlDescription: {
		id: 'core-hosting-marketing.included.custom-url.description',
		defaultMessage: 'Connect your own domain to your server and share it with your friends.',
	},
	backupsIncluded: {
		id: 'core-hosting-marketing.included.backups-included',
		defaultMessage: 'Backups included',
	},
	backupsIncludedDescription: {
		id: 'core-hosting-marketing.included.backups-included.description',
		defaultMessage: 'Automated off-site backups keep your world safe no matter what happens.',
	},
	fileManager: {
		id: 'core-hosting-marketing.included.file-manager',
		defaultMessage: 'Easy to use file manager',
	},
	fileManagerDescription: {
		id: 'core-hosting-marketing.included.file-manager.description',
		defaultMessage: 'Search, manage, edit, and upload files directly to your server with ease.',
	},
	powerfulConsole: {
		id: 'core-hosting-marketing.included.powerful-console',
		defaultMessage: 'A powerful console and panel',
	},
	powerfulConsoleDescription: {
		id: 'core-hosting-marketing.included.powerful-console.description',
		defaultMessage: 'Manage your server from a modern, easy-to-use control panel.',
	},
	support: {
		id: 'core-hosting-marketing.included.support',
		defaultMessage: 'Support when you need it',
	},
	supportDescription: {
		id: 'core-hosting-marketing.included.support.description',
		defaultMessage: 'The {brand} team is here to help you with your server at any time.',
	},
	sftpAccess: {
		id: 'core-hosting-marketing.included.sftp-access',
		defaultMessage: 'SFTP access',
	},
	sftpAccessDescription: {
		id: 'core-hosting-marketing.included.sftp-access.description',
		defaultMessage: "Access your server's files directly with built-in SFTP support.",
	},
	advancedNetworking: {
		id: 'core-hosting-marketing.included.advanced-networking',
		defaultMessage: 'Advanced networking management',
	},
	advancedNetworkingDescription: {
		id: 'core-hosting-marketing.included.advanced-networking.description',
		defaultMessage:
			'Reserve additional ports for mods that need them and fine-tune your server network.',
	},
	faqHeading: {
		id: 'core-hosting-marketing.faq.heading',
		defaultMessage: 'Frequently Asked Questions',
	},
	faqHardware: {
		id: 'core-hosting-marketing.faq.hardware',
		defaultMessage: 'What hardware do Core Hosting servers run on?',
	},
	faqHardwareAnswer: {
		id: 'core-hosting-marketing.faq.hardware.answer',
		defaultMessage:
			'Core Hosting servers are powered by modern AMD Ryzen CPUs at 5+ GHz, paired with fast DDR5 memory.',
	},
	faqDDOSProtection: {
		id: 'core-hosting-marketing.faq.ddos-protection',
		defaultMessage: 'Do Core Hosting servers have DDoS protection?',
	},
	faqDDOSProtectionAnswer: {
		id: 'core-hosting-marketing.faq.ddos-protection.answer',
		defaultMessage:
			'Yes. All Core Hosting servers come with DDoS protection with high-capacity mitigation in every location.',
	},
	faqLocation: {
		id: 'core-hosting-marketing.faq.location',
		defaultMessage: 'Where are Core Hosting servers located?',
	},
	faqLocationAnswer: {
		id: 'core-hosting-marketing.faq.location.answer',
		defaultMessage:
			'Servers are available across North America, Europe, and more, with a choice of region when you order.',
	},
	faqUpgrade: {
		id: 'core-hosting-marketing.faq.upgrade',
		defaultMessage: 'Can I upgrade my server later?',
	},
	faqUpgradeAnswer: {
		id: 'core-hosting-marketing.faq.upgrade.answer',
		defaultMessage:
			'Yes. You can upgrade your plan at any time to get more RAM, CPU, or storage without losing your world.',
	},
	faqHowFast: {
		id: 'core-hosting-marketing.faq.how-fast',
		defaultMessage: 'How fast are Core Hosting servers?',
	},
	faqHowFastAnswer: {
		id: 'core-hosting-marketing.faq.how-fast.answer',
		defaultMessage:
			'Core Hosting runs on very modern high-performance hardware, so your server will run smoothly. Actual performance depends on your mods, data packs, and plugins.',
	},
	faqVersionsLoaders: {
		id: 'core-hosting-marketing.faq.versions-loaders',
		defaultMessage: 'What Minecraft versions and loaders can be used?',
	},
	faqVersionsLoadersAnswer: {
		id: 'core-hosting-marketing.faq.versions-loaders.answer',
		defaultMessage:
			'Servers can run any version of Minecraft: Java Edition, including snapshots, along with loaders such as Fabric, Quilt, Forge, NeoForge, Paper, and Purpur.',
	},
	readyToStart: {
		id: 'core-hosting-marketing.cta.ready-to-start',
		defaultMessage: 'Ready to start your server?',
	},
	readyToStartDescription: {
		id: 'core-hosting-marketing.cta.ready-to-start.description',
		defaultMessage:
			'Join {brand} today and get your Minecraft server online in <contrast>minutes</contrast>.',
	},
	getStartedWithCoreHosting: {
		id: 'core-hosting-marketing.cta.get-started-with-core-hosting',
		defaultMessage: 'Get started with {brand}',
	},
})

const scrollToFaq = () => {
	if (route.hash) {
		const faq = document.querySelector(`[nav-hash="${route.hash.slice(1)}"]`)
		if (faq) {
			faq.open = true
			const top = faq.getBoundingClientRect().top
			const offset = window.innerHeight / 2 - faq.clientHeight / 2
			window.scrollTo({ top: window.scrollY + top - offset, behavior: 'smooth' })
		}
	}
}

onMounted(() => {
	scrollToFaq()
})

watch(() => route.hash, scrollToFaq)
</script>

<style scoped>
.servers-hero {
	background: radial-gradient(
		65% 30% at 50% -10%,
		var(--color-purple-highlight) 0%,
		var(--color-accent-contrast) 100%
	);
}

.faded-brand-line {
	background: linear-gradient(to right, var(--color-purple-highlight), transparent);
}

.details-hide summary::-webkit-details-marker {
	display: none;
}
</style>
