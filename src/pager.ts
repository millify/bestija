/**
 * Page flip between full-viewport screens. Free scrolling is disabled —
 * wheel / swipe / key only steps one screen at a time.
 *
 * Mobile: slim mark + story/menu/reservations → video/hero → visit / follow / legal.
 * Desktop: gallery (2×2) → footer.
 *
 * When a card is expanded (`is-card-open`) or a screen intro is playing,
 * paging stands down.
 */

const WHEEL_THRESHOLD = 40
const SWIPE_THRESHOLD = 56
const COOLDOWN_MS = 780
const MOBILE_MQ = '(max-width: 899px)'

const root = document.documentElement
const reduced = () => root.dataset.motion === 'reduce'

let page = 0
let locked = false
let wheelDelta = 0
let touchY = 0

const cardOpen = () => root.classList.contains('is-card-open')
const introBusy = () => root.classList.contains('is-intro')
const screenAnimating = () => root.classList.contains('is-screen-animating')
const isMobile = () => window.matchMedia(MOBILE_MQ).matches

/** Last page index: 2 on mobile (visit/legal), 1 on desktop (footer). */
export function maxPage() {
	return isMobile() ? 2 : 1
}

export function footerPage() {
	return maxPage()
}

function canPage() {
	return !locked && !introBusy() && !screenAnimating() && !cardOpen()
}

function applyPage(target: number) {
	page = target
	root.dataset.page = String(page)
	root.classList.toggle('is-on-footer', page === maxPage())
}

function go(next: number) {
	const max = maxPage()
	const target = Math.max(0, Math.min(max, next))
	if (target === page || !canPage()) return

	locked = true
	applyPage(target)

	const wait = reduced() ? 0 : COOLDOWN_MS
	window.setTimeout(() => {
		locked = false
		wheelDelta = 0
	}, wait)
}

function step(direction: 1 | -1) {
	go(page + direction)
}

export function goToPage(next: number) {
	go(next)
}

/** Remap page index when crossing the mobile/desktop breakpoint. */
function onBreakpointChange() {
	const onFooter = root.classList.contains('is-on-footer')
	if (isMobile()) {
		// Desktop gallery → mobile gallery A; desktop footer → mobile footer.
		applyPage(onFooter ? 2 : 0)
	} else {
		// Mobile gallery A/B → desktop gallery; mobile footer → desktop footer.
		applyPage(onFooter ? 1 : 0)
	}
}

/** True when the event is aimed at the open card's scrollable content. */
function inOpenCard(target: EventTarget | null) {
	if (!(target instanceof Element)) return false
	return Boolean(target.closest('.tile.is-open'))
}

export function enablePager() {
	const track = document.getElementById('pager-track')
	if (!track) return

	applyPage(0)

	window.matchMedia(MOBILE_MQ).addEventListener('change', onBreakpointChange)

	window.addEventListener(
		'wheel',
		(event) => {
			// Expanded cards own the wheel — don't steal it for paging.
			if (cardOpen()) {
				wheelDelta = 0
				return
			}

			event.preventDefault()
			if (!canPage()) {
				wheelDelta = 0
				return
			}

			wheelDelta += event.deltaY
			if (Math.abs(wheelDelta) < WHEEL_THRESHOLD) return

			const direction = wheelDelta > 0 ? 1 : -1
			wheelDelta = 0
			step(direction)
		},
		{ passive: false },
	)

	window.addEventListener(
		'touchstart',
		(event) => {
			touchY = event.touches[0]?.clientY ?? 0
		},
		{ passive: true },
	)

	window.addEventListener(
		'touchmove',
		(event) => {
			// Let the open card pan; only kill rubber-banding on the pager.
			if (cardOpen() || inOpenCard(event.target)) return
			event.preventDefault()
		},
		{ passive: false },
	)

	window.addEventListener(
		'touchend',
		(event) => {
			if (!canPage()) return
			const endY = event.changedTouches[0]?.clientY ?? touchY
			const delta = touchY - endY
			if (Math.abs(delta) < SWIPE_THRESHOLD) return
			step(delta > 0 ? 1 : -1)
		},
		{ passive: true },
	)

	window.addEventListener(
		'keydown',
		(event) => {
			if (cardOpen()) return
			if (!canPage()) {
				if (introBusy()) event.preventDefault()
				return
			}

			switch (event.key) {
				case 'ArrowDown':
				case 'PageDown':
				case ' ':
					if (event.key === ' ' && isTypingTarget(event.target)) return
					event.preventDefault()
					step(1)
					break
				case 'ArrowUp':
				case 'PageUp':
					event.preventDefault()
					step(-1)
					break
				case 'Home':
					event.preventDefault()
					go(0)
					break
				case 'End':
					event.preventDefault()
					go(maxPage())
					break
				default:
					break
			}
		},
		{ passive: false },
	)

	window.addEventListener(
		'scroll',
		() => {
			if (window.scrollY !== 0) window.scrollTo(0, 0)
		},
		{ passive: true },
	)

	document.getElementById('scroll-cue')?.addEventListener('click', () => {
		step(1)
	})
}

function isTypingTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false
	const tag = target.tagName
	return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function pagerPage() {
	return page
}
