/**
 * Gallery card expand / collapse.
 *
 * The tile is measured in the grid, then reparented to <body> before going
 * fixed — `.grid` has `perspective`, which would otherwise become the
 * containing block for `position: fixed` and throw coordinates off.
 *
 * Open: hero/sheet layout (and hero-band photo) from frame one — one motion
 * into the final state, no second background beat after travel.
 *
 * Close (mobile): hide the sheet and pin the photo to `inset: 0` immediately,
 * then shrink only the box. Never animate media height to `%` while the
 * parent is also shrinking — that was the mid-close clash / flash.
 */

const OPEN_MS = 580
const CLOSE_MS = 480
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
const REVEAL_SELECTOR =
	'.menu-head, .menu-heading, .dish, .menu-note, .allergen, .sheet-head, .sheet-lead, .sheet-block'

const root = document.documentElement
const mobileQuery = () => matchMedia('(max-width: 899px)')

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

/** Sets the resting box first, then plays the animation from `from`. */
function travel(el: HTMLElement, from: Box, to: Box, duration: number) {
	place(el, to)
	if (reduced()) return null
	return el.animate([frame(from), frame(to)], { duration, easing: EASE })
}

function waitAnim(anim: Animation | null) {
	if (!anim) return Promise.resolve()
	return anim.finished.catch(() => {
		/* cancelled — caller decides what to do */
	})
}

function getBackdrop() {
	if (!backdrop) {
		backdrop = document.createElement('div')
		backdrop.className = 'card-backdrop'
		backdrop.addEventListener('click', () => {
			void closeCard()
		})
		document.body.appendChild(backdrop)
	}
	return backdrop
}

/** Backdrop opacity on the same clock as card travel (not a separate CSS fade). */
function fadeBackdrop(show: boolean, duration: number) {
	const el = getBackdrop()
	el.classList.toggle('is-on', show)
	if (reduced()) {
		el.style.opacity = show ? '1' : '0'
		return null
	}
	const to = show ? 1 : 0
	const from = Number.parseFloat(getComputedStyle(el).opacity)
	const start = Number.isFinite(from) ? from : show ? 0 : 1
	return el.animate([{ opacity: start }, { opacity: to }], {
		duration,
		easing: EASE,
		fill: 'forwards',
	})
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
		void closeCard()
	})
	return button
}

function fade(el: HTMLElement, to: number, duration: number) {
	if (reduced()) {
		el.style.opacity = String(to)
		return null
	}
	const from = Number.parseFloat(getComputedStyle(el).opacity) || (to > 0 ? 0 : 1)
	return el.animate([{ opacity: from }, { opacity: to }], {
		duration,
		easing: EASE,
		fill: 'forwards',
	})
}

/**
 * Scroll root for reveals: mobile sheets scroll inside `.card-more`;
 * desktop scrolls the whole `.tile-body`.
 */
function scrollRoot(tile: HTMLElement) {
	const body = tile.querySelector<HTMLElement>('.tile-body')
	if (!body) return null
	const sheet = tile.querySelector<HTMLElement>('.card-more')
	if (mobileQuery().matches && sheet) return sheet
	return body
}

/**
 * Wires long-form scroll: hint fades on first scroll; rows fade up as they
 * enter the scrollport. Returns a teardown that resets scroll + reveals.
 */
function watchScroll(tile: HTMLElement) {
	const scroller = scrollRoot(tile)
	if (!scroller) return () => {}

	const onScroll = () => {
		tile.classList.toggle('is-scrolled', scroller.scrollTop > 24)
	}
	scroller.addEventListener('scroll', onScroll, { passive: true })

	const rows = [...tile.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)]

	const cleanupScroll = () => {
		scroller.scrollTop = 0
		scroller.removeEventListener('scroll', onScroll)
		tile.classList.remove('is-scrolled')
	}

	if (!rows.length || reduced()) {
		return cleanupScroll
	}

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
		{ root: scroller, rootMargin: '0px 0px -8% 0px' },
	)

	rows.forEach((row, index) => {
		row.style.transitionDelay = `${(index % 5) * 55}ms`
		seen.observe(row)
	})

	return () => {
		cleanupScroll()
		seen.disconnect()
		for (const row of rows) {
			row.classList.remove('reveal', 'is-in-view')
			row.style.transitionDelay = ''
		}
	}
}

/**
 * Pin mobile interior to the grid-card look before the box moves.
 * Sheet is removed from layout; photo fills the tile via `inset: 0` so it
 * tracks the shrinking parent without a competing height animation.
 */
function pinMobileToGrid(tile: HTMLElement) {
	const sheet = tile.querySelector<HTMLElement>('.card-more')
	if (sheet) sheet.scrollTop = 0
	tile.classList.add('is-closing')
}

async function openCard(tile: HTMLElement) {
	if (card || closing) return

	const from = boxOf(tile)

	const slot = document.createElement('div')
	slot.className = 'tile-slot'
	slot.setAttribute('aria-hidden', 'true')
	slot.setAttribute('style', tile.getAttribute('style') ?? '')
	tile.parentElement?.insertBefore(slot, tile)
	document.body.appendChild(tile)

	/*
	  Final hero/sheet layout (and hero-band photo) from frame one — the
	  lift grows straight into the open state, no second background beat.
	*/
	tile.classList.add('is-open', 'is-full', 'is-sheet-on', 'is-traveling')
	tile.setAttribute('aria-expanded', 'true')
	root.classList.add('is-card-open')
	place(tile, from)

	const close = makeClose()
	close.style.opacity = '0'
	tile.appendChild(close)

	const lift = travel(tile, from, stageBox(), OPEN_MS)
	fadeBackdrop(true, OPEN_MS)
	fade(close, 1, Math.min(280, OPEN_MS * 0.5))

	card = {
		tile,
		slot,
		close,
		restoreFocus: document.activeElement as HTMLElement | null,
		anim: lift,
		teardown: watchScroll(tile),
	}
	close.focus({ preventScroll: true })

	await waitAnim(lift)
	if (!card || card.tile !== tile) return
	tile.classList.remove('is-traveling')
}

async function closeCard() {
	if (!card || closing) return

	const { tile, slot, close, restoreFocus, teardown } = card
	card.anim?.cancel()
	card = null
	closing = true

	const from = boxOf(tile)
	const to = boxOf(slot)
	const mobile = mobileQuery().matches

	/*
	  Interior first (same frame as shrink start): grid photo + no sheet.
	  Then only the box travels. Teardown already matches the grid card.
	*/
	tile.classList.add('is-traveling')
	if (mobile) pinMobileToGrid(tile)

	fade(close, 0, Math.min(220, CLOSE_MS * 0.45))
	fadeBackdrop(false, CLOSE_MS)

	const settle = () => {
		teardown()
		close.remove()
		close.style.opacity = ''
		getBackdrop().style.opacity = ''
		tile.classList.remove(
			'is-open',
			'is-full',
			'is-traveling',
			'is-closing',
			'is-scrolled',
			'is-sheet-on',
		)
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

	const shrink = travel(tile, from, to, CLOSE_MS)
	if (!shrink) {
		settle()
		return
	}
	await waitAnim(shrink)
	settle()
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
		if (tile && isReady(tile)) void openCard(tile)
	})

	grid.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter' && event.key !== ' ') return
		const tile = (event.target as HTMLElement).closest<HTMLElement>(
			'.tile:not(.tile--logo)',
		)
		if (!tile || !isReady(tile)) return
		event.preventDefault()
		void openCard(tile)
	})

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') void closeCard()
	})

	addEventListener('resize', () => {
		if (!card || closing) return
		card.anim?.cancel()
		place(card.tile, stageBox())
	})
}
