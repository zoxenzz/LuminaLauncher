<script lang="ts"></script>

<script setup lang="ts">
import { RightArrowIcon } from '@modrinth/assets'
import { type Component, computed, nextTick, ref } from 'vue'

import { type MessageDescriptor, useVIntl } from '../../composables/i18n'
import { useScrollIndicator } from '../../composables/scroll-indicator'
import NewModal from './NewModal.vue'
export interface Tab {
	name: MessageDescriptor
	icon: Component
	content?: Component
	href?: string
	badge?: MessageDescriptor
	shown?: boolean
}

const { formatMessage } = useVIntl()

const props = withDefaults(
	defineProps<{
		tabs: Tab[]
		header?: string
		maxWidth?: string
		width?: string
		closable?: boolean
		onHide?: () => void
		onShow?: () => void
	}>(),
	{
		header: undefined,
		maxWidth: undefined,
		width: undefined,
		closable: true,
		onHide: undefined,
		onShow: undefined,
	},
)

const visibleTabs = computed(() => props.tabs.filter((tab) => tab.shown !== false))

const selectedTab = ref(0)

const scrollContainer = ref<HTMLElement | null>(null)
const { showTopFade, showBottomFade, checkScrollState, forceCheck } =
	useScrollIndicator(scrollContainer)

const modal = ref<InstanceType<typeof NewModal> | null>(null)

function setTab(index: number) {
	selectedTab.value = index
	nextTick(() => forceCheck())
}

function show(event?: MouseEvent) {
	modal.value?.show(event)
}

function hide() {
	modal.value?.hide()
}

defineExpose({ show, hide, selectedTab, setTab })
</script>
<template>
	<NewModal
		ref="modal"
		:header="header"
		:max-width="maxWidth"
		:width="width"
		:closable="closable"
		:on-hide="onHide"
		:on-show="onShow"
		no-padding
	>
		<template v-if="$slots.title" #title>
			<slot name="title" />
		</template>
		<div class="grid grid-cols-[auto_1fr] gap-4 p-6 pb-3 pr-0">
			<div class="tabbed-modal-sidebar">
				<component
					:is="tab.href ? 'a' : 'button'"
					v-for="(tab, index) in visibleTabs"
					:key="index"
					:href="tab.href ?? undefined"
					:target="tab.href ? '_blank' : undefined"
					:rel="tab.href ? 'noopener noreferrer' : undefined"
					:class="
						selectedTab === index ? 'tabbed-modal-tab tabbed-modal-tab-active' : 'tabbed-modal-tab'
					"
					@click="!tab.href && setTab(index)"
				>
					<component :is="tab.icon" class="w-4 h-4 flex-shrink-0" />
					<span>{{ formatMessage(tab.name) }}</span>
					<span
						v-if="tab.badge"
						class="rounded-full px-1.5 py-0.5 text-xs font-bold bg-brand-highlight text-brand-green"
					>
						{{ formatMessage(tab.badge) }}
					</span>
					<RightArrowIcon v-if="tab.href" class="size-4 ml-auto" />
				</component>

				<slot name="footer" />
			</div>
			<div class="tabbed-modal-content">
				<Transition
					enter-active-class="transition-all duration-200 ease-out"
					enter-from-class="opacity-0 max-h-0"
					enter-to-class="opacity-100 max-h-4"
					leave-active-class="transition-all duration-200 ease-in"
					leave-from-class="opacity-100 max-h-4"
					leave-to-class="opacity-0 max-h-0"
				>
					<div
						v-if="showTopFade"
						class="pointer-events-none absolute left-0 right-0 top-0 z-10 h-4 bg-gradient-to-b from-bg-raised to-transparent"
					/>
				</Transition>

				<div
					ref="scrollContainer"
					class="overflow-y-auto px-6 pb-6 h-screen max-h-[min(65vh,600px)]"
					@scroll="checkScrollState"
				>
					<Suspense>
						<component
							:is="visibleTabs[selectedTab]?.content"
							v-if="visibleTabs[selectedTab]?.content"
						/>
					</Suspense>
				</div>

				<Transition
					enter-active-class="transition-all duration-200 ease-out"
					enter-from-class="opacity-0 max-h-0"
					enter-to-class="opacity-100 max-h-16"
					leave-active-class="transition-all duration-200 ease-in"
					leave-from-class="opacity-100 max-h-16"
					leave-to-class="opacity-0 max-h-0"
				>
					<div
						v-if="showBottomFade"
						class="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-16 bg-gradient-to-t from-bg-raised to-transparent"
					/>
				</Transition>
			</div>
		</div>
	</NewModal>
</template>

<style lang="scss" scoped>
.tabbed-modal-sidebar {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	min-width: 200px;
	padding: 0.75rem;
	border-radius: 1.25rem;
	border: 1px solid color-mix(in srgb, var(--color-brand) 18%, transparent);
	background:
		linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent),
		color-mix(in srgb, var(--color-raised-bg) 88%, transparent);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.tabbed-modal-tab {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	width: 100%;
	text-align: left;
	white-space: nowrap;
	border: 1px solid transparent;
	border-radius: 0.9rem;
	padding: 0.5rem 0.75rem;
	background: transparent;
	color: var(--color-text-default);
	font: inherit;
	font-size: 0.95rem;
	font-weight: 600;
	text-decoration: none;
	cursor: pointer;
	transition:
		background-color 150ms ease,
		color 150ms ease,
		border-color 150ms ease,
		transform 150ms ease;

	&:hover {
		background: color-mix(in srgb, var(--color-brand) 8%, transparent);
		color: var(--color-contrast);
	}
}

.tabbed-modal-tab-active {
	color: var(--color-contrast);
	border-color: color-mix(in srgb, var(--color-brand) 22%, transparent);
	background:
		radial-gradient(
			ellipse at center,
			color-mix(in srgb, var(--color-brand) 18%, transparent),
			transparent 72%
		),
		color-mix(in srgb, var(--color-raised-bg) 55%, transparent);
	box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-brand) 10%, transparent);
}

.tabbed-modal-content {
	position: relative;
	overflow: hidden;
	padding: 0.25rem;
	border-radius: 1.25rem;
	border: 1px solid color-mix(in srgb, var(--color-brand) 18%, transparent);
	background:
		linear-gradient(180deg, rgba(255, 255, 255, 0.026), transparent),
		color-mix(in srgb, var(--color-raised-bg) 88%, transparent);
	box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
</style>
