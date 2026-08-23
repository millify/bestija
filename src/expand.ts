/**
 * Click a card to blow it up to full bleed; Escape, the X, or the backdrop
 * puts it back.
 *
 * The card is measured inside the grid, then moved to <body> before it goes
 * fixed — `.grid` has a `perspective`, which would otherwise make it the
 * containing block for fixed children and throw the coordinates off.
 */

const OPEN_MS = 560
const CLOSE_MS = 420
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

interface Box {
	top: number
	left: number
	width: number
	height: number
}

interface OpenCard {
	tile: HTMLElement
	slot: HTMLElement
	close: HTMLButtonElement
	restoreFocus: HTMLElement | null
	anim: Animation | null
	teardown: () => void
}

/** Rows that fade up as the guest scrolls the sheet. */
const REVEAL_SELECTOR = '.menu-head, .menu-heading, .dish, .menu-note'

const root = document.documentElement

let backdrop: HTMLElement | null = null
let card: OpenCard | null = null
/** True while a card is shrinking back, so nothing else can grab it. */
let closing = false

const reduced = () => root.dataset.motion === 'reduce'

function boxOf(el: Element): Box {
	const rect = el.getBoundingClientRect()
	return {
		top: rect.top,
		left: rect.left,
		width: rect.width,
		height: rect.height,
	}
}

/** The shell's content box — where an expanded card comes to rest. */
function stageBox(): Box {
	const shell = document.querySelector<HTMLElement>('.shell')
	if (!shell) return { top: 0, left: 0, width: innerWidth, height: innerHeight }

	const rect = shell.getBoundingClientRect()
	const pad = parseFloat(getComputedStyle(shell).paddingTop) || 0
	return {
		top: rect.top + pad,
		left: rect.left + pad,
		width: rect.width - pad * 2,
		height: rect.height - pad * 2,
	}
}

function place(el: HTMLElement, box: Box) {
	el.style.top = `${box.top}px`
	el.style.left = `${box.left}px`
	el.style.width = `${box.width}px`
	el.style.height = `${box.height}px`
}

const frame = (box: Box) => ({
	top: `${box.top}px`,
	left: `${box.left}px`,
	width: `${box.width}px`,
	height: `${box.height}px`,
})

/** Sets the resting styles first, then plays the animation from `from`. */
function travel(el: HTMLElement, from: Box, to: Box, duration: number) {
	place(el, to)
	if (reduced()) return null
	return el.animate([frame(from), frame(to)], { duration, easing: EASE })
}

function getBackdrop() {
	if (!backdrop) {
		backdrop = document.createElement('div')
		backdrop.className = 'card-backdrop'
		backdrop.addEventListener('click', closeCard)
		document.body.appendChild(backdrop)
	}
	return backdrop
}

function makeClose() {
	const button = document.createElement('button')
	button.type = 'button'
	button.className = 'tile-close'
	button.setAttribute('aria-label', 'Close')
	button.innerHTML =
		'<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2 14 14M14 2 2 14" /></svg>'
	button.addEventListener('click', (event) => {
		event.stopPropagation()
		closeCard()
	})
	return button
}

/**
 * Wires up the long-form content an expanded card scrolls through: the hint
 * fades on first scroll, and rows fade up as they enter the card.
 */
function watchScroll(tile: HTMLElement) {
	const body = tile.querySelector<HTMLElement>('.tile-body')
	const rows = [...tile.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)]
	if (!body || !rows.length) return () => {}

	const onScroll = () => {
		tile.classList.toggle('is-scrolled', body.scrollTop > 24)
	}
	body.addEventListener('scroll', onScroll, { passive: true })

	if (reduced()) return () => body.removeEventListener('scroll', onScroll)

	for (const row of rows) row.classList.add('reveal')

	const seen = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue
				const row = entry.target as HTMLElement
				seen.unobserve(row)
				row.classList.add('is-in-view')
			}
		},
		{ root: body, rootMargin: '0px 0px -8% 0px' },
	)

	rows.forEach((row, index) => {
		// Rows arrive in clusters, so the stagger restarts every few of them.
		row.style.transitionDelay = `${(index % 5) * 55}ms`
		seen.observe(row)
	})

	return () => {
		body.scrollTop = 0
		body.removeEventListener('scroll', onScroll)
		seen.disconnect()
		for (const row of rows) {
			row.classList.remove('reveal', 'is-in-view')
			row.style.transitionDelay = ''
		}
	}
}

function openCard(tile: HTMLElement) {
	if (card || closing) return

	const from = boxOf(tile)

	const slot = document.createElement('div')
	slot.className = 'tile-slot'
	slot.setAttribute('aria-hidden', 'true')
	slot.setAttribute('style', tile.getAttribute('style') ?? '')
	tile.parentElement?.insertBefore(slot, tile)

	tile.classList.add('is-open', 'is-full')
	tile.setAttribute('aria-expanded', 'true')
	root.classList.add('is-card-open')
	document.body.appendChild(tile)

	const close = makeClose()
	tile.appendChild(close)
	getBackdrop().classList.add('is-on')

	const anim = travel(tile, from, stageBox(), OPEN_MS)

	card = {
		tile,
		slot,
		close,
		restoreFocus: document.activeElement as HTMLElement | null,
		anim,
		teardown: watchScroll(tile),
	}
	close.focus({ preventScroll: true })
}

function closeCard() {
	if (!card || closing) return

	const { tile, slot, close, restoreFocus, teardown } = card
	// Measured before cancelling, so an interrupted open reverses from where
	// the card actually is rather than from its resting box.
	const from = boxOf(tile)
	card.anim?.cancel()
	card = null
	closing = true
	teardown()

	const to = boxOf(slot)

	// Drop the expanded typography now so the copy reflows during the shrink.
	tile.classList.remove('is-full')
	getBackdrop().classList.remove('is-on')
	close.animate([{ opacity: 1 }, { opacity: 0 }], {
		duration: 140,
		fill: 'forwards',
	})

	const settle = () => {
		close.remove()
		tile.classList.remove('is-open', 'is-scrolled')
		tile.setAttribute('aria-expanded', 'false')
		tile.style.top = ''
		tile.style.left = ''
		tile.style.width = ''
		tile.style.height = ''
		slot.parentElement?.insertBefore(tile, slot)
		slot.remove()
		root.classList.remove('is-card-open')
		restoreFocus?.focus?.({ preventScroll: true })
		closing = false
	}

	const anim = travel(tile, from, to, CLOSE_MS)
	if (!anim) {
		settle()
		return
	}
	anim.finished.then(settle).catch(settle)
}

/** Cards only become interactive once the intro has revealed them. */
const isReady = (tile: HTMLElement) => tile.classList.contains('is-text-in')

export function enableCardExpand() {
	const grid = document.querySelector<HTMLElement>('.grid')
	if (!grid) return

	for (const tile of grid.querySelectorAll<HTMLElement>(
		'.tile:not(.tile--logo)',
	)) {
		tile.setAttribute('role', 'button')
		tile.setAttribute('tabindex', '0')
		tile.setAttribute('aria-expanded', 'false')
	}

	grid.addEventListener('click', (event) => {
		const tile = (event.target as HTMLElement).closest<HTMLElement>(
			'.tile:not(.tile--logo)',
		)
		if (tile && isReady(tile)) openCard(tile)
	})

	grid.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' && event.key !== ' ') return
		const tile = (event.target as HTMLElement).closest<HTMLElement>(
			'.tile:not(.tile--logo)',
		)
		if (!tile || !isReady(tile)) return
		event.preventDefault()
		openCard(tile)
	})

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') closeCard()
	})

	// An expanded card is pinned to the shell, so follow the viewport.
	addEventListener('resize', () => {
		if (!card) return
		card.anim?.cancel()
		place(card.tile, stageBox())
	})
}
