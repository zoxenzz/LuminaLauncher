<template>
	<RouterLink
		v-if="typeof to === 'string'"
		:to="to"
		v-bind="$attrs"
		:active-class="''"
		:class="{
			'router-link-active': isPrimary && isPrimary(route),
			'subpage-active': isSubpage && isSubpage(route),
			disabled: disabled,
		}"
		class="nav-button-link"
	>
		<slot />
	</RouterLink>
	<button
		v-else
		v-bind="$attrs"
		class="nav-button-link button-animation"
		:disabled="disabled"
		@click="to"
	>
		<slot />
	</button>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

type RouteFunction = (route: RouteLocationNormalizedLoaded) => boolean

withDefaults(
	defineProps<{
		to: (() => void) | string
		isPrimary?: RouteFunction
		isSubpage?: RouteFunction
		highlightOverride?: boolean
		disabled?: boolean
	}>(),
	{
		isPrimary: undefined,
		isSubpage: undefined,
		highlightOverride: undefined,
		disabled: false,
	},
)

defineOptions({
	inheritAttrs: false,
})
</script>

<style lang="scss" scoped>
.nav-button-link {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	width: var(--dock-btn-size, 3rem);
	height: var(--dock-btn-size, 3rem);
	border: 1px solid transparent;
	border-radius: 0.9rem;
	background: transparent;
	color: var(--color-text-tertiary);
	font-size: 1.25rem;
	text-decoration: none;
	cursor: pointer;
	transition:
		transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
		color 200ms cubic-bezier(0.22, 1, 0.36, 1),
		opacity 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.nav-button-link :deep(svg) {
	transition: transform 150ms ease;
	transform-origin: center;
}

.nav-button-link:hover {
	transform: scale(1.06);
	color: var(--color-text-default);
}

.nav-button-link:active {
	transform: scale(0.96);
}

.nav-button-link.disabled {
	opacity: 0.35;
	cursor: not-allowed;
	pointer-events: none;
}

/* Active state: flat gold-tinted pill with a hairline border — no radial glow.
   `.router-link-exact-active` covers the plain nav items (Home/Worlds/Skins):
   vue-router's prefix `router-link-active` is disabled above (`active-class=""`)
   so the root `/` link does not stay lit on every route. */
.router-link-exact-active::after,
.router-link-active::after,
.subpage-active::after {
	content: '';
	position: absolute;
	inset: 0.35rem;
	border-radius: 0.85rem;
	background: color-mix(in srgb, var(--color-brand) 20%, transparent);
	border: 1px solid color-mix(in srgb, var(--color-brand) 26%, transparent);
	opacity: 0;
	transition: opacity 200ms ease;
	pointer-events: none;
}

.router-link-exact-active,
.router-link-active,
.subpage-active {
	color: var(--color-brand);
}

.router-link-exact-active::after,
.router-link-active::after,
.subpage-active::after {
	opacity: 1;
}
</style>
