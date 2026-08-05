/**
 * Shared-element "card expand" transition for partnered server cards.
 *
 * When a card is clicked, its banner visually expands and morphs into the
 * destination page's hero banner instead of an instant route change.
 *
 * Strategy:
 * - Preferred: the View Transitions API (`document.startViewTransition`),
 *   which interpolates position/size/border-radius for us and handles
 *   back-navigation for free (WebKitGTK/WKWebView fall back to FLIP).
 * - Fallback: a manual FLIP animation (park the destination hero at the
 *   source card's rect, then animate it home, crossfade, clean up).
 *
 * Both paths are skipped when the user prefers reduced motion or when
 * advanced rendering is disabled, in which case navigation happens normally
 * (the app's existing page fade covers it).
 *
 * Timing note: App.vue wraps the RouterView in a `mode="out-in"` page
 * transition, which normally delays the new page's mount until the old page
 * finishes leaving. A View Transition captures its new snapshot right after
 * the navigation callback settles, so the destination hero would not exist
 * yet. To fix this, the transition's promise is held open until the
 * destination hero registers (`registerDestinationElement`), and App.vue
 * suppresses the page fade while `cardExpandActive` is true so the mount is
 * immediate.
 */
import { ref } from 'vue'
import { useTheming } from '@/store/state'

/**
 * True while a card-expand View Transition is in flight. App.vue binds the
 * RouterView page fade to this (`:css="!cardExpandActive"`) so the destination
 * page mounts instantly — the hero must exist before the new snapshot is
 * captured for the shared-element morph to pair.
 */
export const cardExpandActive = ref(false)

/** A single active expand transition, keyed by the destination's partner id. */
type PendingTransition = {
	partnerId: string
	/** Rect of the source card banner at click time. */
	sourceRect: DOMRect
}

let pendingTransition: PendingTransition | null = null

/** Resolver for the in-flight View Transition's promise, set by `beginCardExpand`. */
let destinationReady: (() => void) | null = null
let destinationReadyTimeout: number | null = null

/**
 * Shared `view-transition-name` for the card-expand morph.
 *
 * A single static name is safe because only one expand can be pending at a
 * time (`pendingTransition` is a singleton, and the source banner's name is
 * cleared right after the old snapshot is taken). It lets App.vue's global
 * `::view-transition-old/new(partnered-server-banner)` rules target the pair
 * without knowing the partner id in advance.
 */
export const SHARED_ELEMENT_NAME = 'partnered-server-banner'

/** How long the morph plays, matching the app's entrance motion curve. */
export const CARD_EXPAND_DURATION_MS = 400

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Called from the card when it is clicked.
 *
 * Records the source banner's rect and, if supported, kicks off a View
 * Transition around the navigation so the destination hero morphs from the
 * card. The source banner briefly carries the shared `view-transition-name`
 * so the browser can pair it with the destination hero (which applies the
 * same name in `registerDestinationElement`); the name is cleared right
 * after the old snapshot is taken so the two never collide.
 */
export function beginCardExpand(
	partnerId: string,
	sourceElement: HTMLElement | null,
	performNavigation: () => void,
): void {
	const themeStore = useTheming()

	if (!themeStore.advancedRendering || prefersReducedMotion() || !sourceElement) {
		performNavigation()
		return
	}

	pendingTransition = {
		partnerId,
		sourceRect: sourceElement.getBoundingClientRect(),
	}

	if (typeof document.startViewTransition === 'function') {
		const name = SHARED_ELEMENT_NAME
		// Set before startViewTransition so the old snapshot captures it.
		sourceElement.style.viewTransitionName = name

		cardExpandActive.value = true
		try {
			const transition = document.startViewTransition(() => {
				// Old snapshot is already taken — the name can go now.
				window.setTimeout(() => clearSharedName(sourceElement, name), 0)
				performNavigation()

				// Hold the transition open until the destination hero has
				// mounted with the shared name, so the new snapshot pairs with
				// the card's snapshot. A safety timeout prevents a hang if the
				// destination page never mounts (e.g. a failed navigation).
				return new Promise<void>((resolve) => {
					destinationReady = resolve
					destinationReadyTimeout = window.setTimeout(() => {
						destinationReady = null
						destinationReadyTimeout = null
						resolve()
					}, CARD_EXPAND_DURATION_MS + 600)
				})
			})
			// Re-enable the page fade once the morph finishes (or is skipped).
			void transition.finished.then(
				() => {
					cardExpandActive.value = false
				},
				() => {
					cardExpandActive.value = false
				},
			)
		} catch {
			// Another View Transition may already be running — fall back to a
			// plain navigation, re-enable the page fade, and clear the name we
			// set on the source banner before the failed call.
			clearSharedName(sourceElement, name)
			cardExpandActive.value = false
			performNavigation()
		}
		return
	}

	performNavigation()
}

/**
 * Called from the destination page once its hero element exists.
 *
 * For View Transitions, applies the shared `view-transition-name` so the
 * browser pairs it with the card's banner snapshot, then releases the
 * in-flight transition so the new state can be captured. For the FLIP
 * fallback, parks the hero at the card's position and animates it home.
 * Returns true if a morph is being handled.
 */
export function registerDestinationElement(
	partnerId: string,
	destinationElement: HTMLElement | null,
): boolean {
	const transition = pendingTransition
	if (!transition || transition.partnerId !== partnerId || !destinationElement) {
		return false
	}

	const name = SHARED_ELEMENT_NAME
	destinationElement.style.viewTransitionName = name

	if (typeof document.startViewTransition === 'function') {
		// The name is now in place on the hero — release the transition so the
		// browser snapshots the new state (with the name set) and morphs it.
		pendingTransition = null
		releaseDestinationReady()
		window.setTimeout(
			() => clearSharedName(destinationElement, name),
			CARD_EXPAND_DURATION_MS + 100,
		)
		return true
	}

	// FLIP fallback: the hero is at its final position; park it at the card's
	// rect first, then play to identity so it visually travels.
	playFlip(destinationElement, transition.sourceRect, () => {
		clearSharedName(destinationElement, name)
	})
	pendingTransition = null
	return true
}

function releaseDestinationReady(): void {
	if (destinationReadyTimeout !== null) {
		window.clearTimeout(destinationReadyTimeout)
		destinationReadyTimeout = null
	}
	if (destinationReady) {
		destinationReady()
		destinationReady = null
	}
}

function clearSharedName(element: HTMLElement, name: string): void {
	if (element.style.viewTransitionName === name) {
		element.style.viewTransitionName = ''
	}
}

function playFlip(destination: HTMLElement, sourceRect: DOMRect, onComplete: () => void): void {
	const destinationRect = destination.getBoundingClientRect()
	if (destinationRect.width === 0 || destinationRect.height === 0) {
		onComplete()
		return
	}

	const scaleX = sourceRect.width / destinationRect.width
	const scaleY = sourceRect.height / destinationRect.height
	const translateX = sourceRect.left - destinationRect.left
	const translateY = sourceRect.top - destinationRect.top

	// Park the hero exactly where the card banner was.
	destination.style.transformOrigin = 'top left'
	destination.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`

	// Give the browser a frame to paint the parked state, then animate home.
	requestAnimationFrame(() => {
		destination.style.transition = `transform ${CARD_EXPAND_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
		destination.style.transform = 'translate(0, 0) scale(1, 1)'

		window.setTimeout(() => {
			destination.style.transition = ''
			destination.style.transform = ''
			destination.style.transformOrigin = ''
			onComplete()
		}, CARD_EXPAND_DURATION_MS)
	})
}
