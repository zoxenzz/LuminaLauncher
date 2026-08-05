<script setup lang="ts">
import GridDisplay from '@/components/GridDisplay.vue'

defineProps({
	instances: {
		type: Array,
		required: true,
	},
})
</script>
<template>
	<GridDisplay v-if="instances && instances.length > 0" label="Instances" :instances="instances" />
	<div v-else class="flex items-center justify-center h-full text-color-text-default">
		<p>No instances yet. Create one to get started!</p>
	</div>
</template>
