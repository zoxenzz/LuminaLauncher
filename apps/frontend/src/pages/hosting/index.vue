<script setup lang="ts">
import { coreHosting, CoreHostingPage } from '@modrinth/ui'

const title = `${coreHosting.brandName} — Partnered Minecraft Hosting`
const description = `Get your Minecraft server online in minutes with ${coreHosting.brandName}, the partnered hosting provider for this launcher.`

useSeoMeta({
	title,
	description,
	ogTitle: title,
	ogDescription: description,
})

onMounted(() => {
	document.body.style.background = 'var(--color-accent-contrast)'
	document.body.style.overflowX = 'hidden !important'
	const layoutDiv = document.querySelector('.layout')
	if (layoutDiv) {
		layoutDiv.style.background = 'var(--color-accent-contrast)'
	}
})

onUnmounted(() => {
	document.body.style.background = ''
	document.body.style.overflowX = ''
	const layoutDiv = document.querySelector('.layout')
	if (layoutDiv) {
		layoutDiv.style.background = ''
	}
})
</script>

<template>
	<CoreHostingPage class="-mt-44" />
</template>
