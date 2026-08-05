<template>
	<div class="loading-indicator-shell" role="status" aria-live="polite">
		<div class="loading-indicator-card">
			<div class="loading-indicator-spinner" aria-hidden="true" />
			<div class="loading-indicator-label">
				Loading<span class="loading-indicator-dots" aria-hidden="true"></span>
			</div>
		</div>
	</div>
</template>

<script setup></script>
<style scoped>
.loading-indicator-shell {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	padding: 2rem 1rem;
}

.loading-indicator-card {
	display: inline-flex;
	align-items: center;
	gap: 0.85rem;
	padding: 0.85rem 1rem;
	border-radius: 999px;
	border: 1px solid color-mix(in srgb, var(--color-brand) 22%, transparent);
	/* Solid, not frosted: no translucent/backdrop-blurred surface, so the
	   loading state never reads as a full-screen glass overlay and the page
	   behind it stays fully visible. */
	background: linear-gradient(135deg, var(--color-raised-bg) 0%, var(--color-bg) 100%);
	box-shadow:
		0 14px 32px rgba(0, 0, 0, 0.25),
		inset 0 1px 0 color-mix(in srgb, var(--color-brand) 10%, transparent),
		0 0 0 1px color-mix(in srgb, var(--color-brand) 8%, transparent);
}

.loading-indicator-spinner {
	display: inline-block;
	width: 1.1rem;
	height: 1.1rem;
	border-radius: 999px;
	border: 2px solid color-mix(in srgb, var(--color-brand) 24%, transparent);
	border-top-color: var(--color-brand);
	border-right-color: color-mix(in srgb, var(--color-brand) 72%, transparent);
	animation: spin 0.85s linear infinite;
	box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-brand) 8%, transparent);
	flex-shrink: 0;
}

.loading-indicator-label {
	font-size: 0.95rem;
	font-weight: 700;
	color: var(--color-contrast);
	letter-spacing: 0.02em;
}

.loading-indicator-dots::after {
	content: '';
	animation: dots 1.2s steps(4, end) infinite;
}

@keyframes dots {
	0% {
		content: '';
	}
	25% {
		content: '.';
	}
	50% {
		content: '..';
	}
	75% {
		content: '...';
	}
	100% {
		content: '...';
	}
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}
</style>
