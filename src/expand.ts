/**
 * Gallery card expand / collapse.
 *
 * The tile is measured in the grid, then reparented to <body> before going
 * fixed — `.grid` has `perspective`, which would otherwise become the
 * containing block for `position: fixed` and throw coordinates off.
 *
 * Open: hide title (grid size) → expand → matrix title + cue together on land.
 * Close: collapse sheet + fade lead out → shrink → matrix grid title.
 */

import { decodeHosts } from './matrix'
import { playIconCue, resetIconCue } from './scroll-cue'

const OPEN_MS = 520
const CLOSE_MS = 400
const SHEET_COLLAPSE_MS = 280
const TITLE_FADE_MS = 90
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
	'.menu-head, .menu-heading, .dish, .menu-note, .sheet-head, .sheet-lead, .sheet-block, .story-brand, .story-head, .story-gallery-grid, .reserve-head, .gift-layout'

const root = document.documentElement
const mobileQuery = () => matchMedia('(max-width: 899px)')

let backdrop: HTMLElement | null = null
let card: OpenCard | null = null
/** True while a card is shrinking back, so nothing else can grab it. */
let closing = false
/** True while the open fade/travel sequence is running. */
let opening = false

const reduced = () => root.dataset.motion === 'reduce'

function sleep(ms: number) {
	return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

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
	// Drop prior opacity fills — otherwise `fill: forwards` keeps the title
	// stuck invisible after we try to show it again for the matrix decode.
	for (const anim of el.getAnimations()) anim.cancel()

	if (reduced()) {
		el.style.opacity = String(to)
		return null
	}
	const from = Number.parseFloat(getComputedStyle(el).opacity)
	const start = Number.isFinite(from) ? from : to > 0 ? 0 : 1
	el.style.opacity = ''
	return el.animate([{ opacity: start }, { opacity: to }], {
		duration,
		easing: EASE,
		fill: 'forwards',
	})
}

/** Cancel opacity anims and set a resting opacity ('' = CSS default). */
function clearOpacity(el: HTMLElement | null, opacity = '') {
	if (!el) return
	for (const anim of el.getAnimations()) anim.cancel()
	el.style.opacity = opacity
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
 * Bring the open card back to a full-bleed hero before the box shrinks —
 * scroll content away, then collapse the sheet so minimize isn’t fighting
 * a mid-scroll layout.
 */
async function collapseSheetForClose(tile: HTMLElement) {
	const scroller = scrollRoot(tile)
	if (scroller && scroller.scrollTop > 0) {
		if (reduced()) {
			scroller.scrollTop = 0
		} else {
			const distance = scroller.scrollTop
			scroller.scrollTo({ top: 0, behavior: 'smooth' })
			// Cap wait — don’t stall on slow smooth-scroll implementations.
			await sleep(Math.min(420, 120 + distance * 0.35))
			scroller.scrollTop = 0
		}
	}

	tile.classList.remove('is-scrolled', 'is-sheet-on')
	tile.classList.add('is-closing')

	if (reduced()) return
	await sleep(SHEET_COLLAPSE_MS)
}

function tileText(tile: HTMLElement) {
	return tile.querySelector<HTMLElement>('.tile-lead .tile-text')
}

function titleHost(tile: HTMLElement) {
	return tile.querySelector<HTMLElement>('.tile-lead .tile-text h2')
}

function scrollHint(tile: HTMLElement) {
	return tile.querySelector<HTMLElement>('.tile-lead .scroll-hint')
}

function hintLabel(tile: HTMLElement) {
	return (
		tile.querySelector<HTMLElement>('.tile-lead .scroll-hint-label') ??
		scrollHint(tile)
	)
}

function hintIcon(tile: HTMLElement) {
	return tile.querySelector<HTMLElement>('.tile-lead .scroll-hint-icon')
}

/** True when the scroll cue is actually shown (hidden on mobile open cards). */
function hintVisible(hint: HTMLElement) {
	return getComputedStyle(hint).display !== 'none'
}

/** Fade title + scroll cue together (used on close). */
async function fadeLead(tile: HTMLElement, to: number) {
	const text = tileText(tile)
	const hint = scrollHint(tile)
	await Promise.all([
		waitAnim(text ? fade(text, to, TITLE_FADE_MS) : null),
		waitAnim(hint ? fade(hint, to, TITLE_FADE_MS) : null),
	])
	clearOpacity(text, to === 0 ? '0' : '')
	clearOpacity(hint, to === 0 ? '0' : '')
}

/** In-flight lead matrix per tile — aborted when that tile opens again. */
const leadDecodes = new WeakMap<HTMLElement, AbortController>()

function abortLeadDecode(tile: HTMLElement) {
	const active = leadDecodes.get(tile)
	if (!active) return
	active.abort()
	leadDecodes.delete(tile)
}

/**
 * Matrix-decode hosts. Stays invisible until `decodeHosts` has sync-split
 * the text into `.ch` glyphs — otherwise the plain hero title flashes for
 * a frame before the scramble starts.
 *
 * Scroll icon (mouse → scramble → chevron) starts with the text matrix so
 * both land around the same moment.
 */
async function decodeLead(tile: HTMLElement, opts: { cue: boolean }) {
	abortLeadDecode(tile)
	const ac = new AbortController()
	leadDecodes.set(tile, ac)

	const text = tileText(tile)
	const title = titleHost(tile)
	const hint = scrollHint(tile)
	const label = hintLabel(tile)
	const icon = hintIcon(tile)

	resetIconCue(icon)

	const hosts: HTMLElement[] = []
	if (title) hosts.push(title)
	else if (text) hosts.push(text)

	const showCue = opts.cue && hint && hintVisible(hint) && label
	if (showCue && label) hosts.push(label)

	const reveal = [text, showCue ? hint : null].filter(Boolean) as HTMLElement[]

	for (const el of reveal) clearOpacity(el, '0')

	if (!hosts.length) {
		for (const el of reveal) clearOpacity(el)
		if (leadDecodes.get(tile) === ac) leadDecodes.delete(tile)
		return
	}

	// `decodeHosts` splits text synchronously before returning its promise.
	const textDone = decodeHosts(hosts, ac.signal)
	for (const el of reveal) clearOpacity(el)

	const iconDone =
		showCue && icon ? playIconCue(icon, ac.signal) : Promise.resolve()

	await Promise.all([textDone, iconDone])

	if (leadDecodes.get(tile) === ac) leadDecodes.delete(tile)
}

async function openCard(tile: HTMLElement) {
	if (card || closing || opening) return
	opening = true

	try {
		// Stop any close-matrix still running on this tile.
		abortLeadDecode(tile)
		resetIconCue(hintIcon(tile))

		const text = tileText(tile)
		const hint = scrollHint(tile)

		// Hide at grid size first — never let the hero type flash mid-expand.
		clearOpacity(text, '0')
		clearOpacity(hint, '0')

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

		// Landed — title + description matrix start together, no wait.
		await decodeLead(tile, { cue: true })
	} finally {
		opening = false
	}
}

async function closeCard() {
	if (!card || closing) return

	const { tile, slot, close, restoreFocus, teardown } = card
	card.anim?.cancel()
	card = null
	closing = true
	opening = false

	// Stop open-matrix if the guest closed mid-decode.
	abortLeadDecode(tile)
	resetIconCue(hintIcon(tile))

	try {
		const to = boxOf(slot)

		fade(close, 0, Math.min(160, CLOSE_MS * 0.4))

		// Title + scroll cue out together, in parallel with the sheet collapse.
		await Promise.all([collapseSheetForClose(tile), fadeLead(tile, 0)])

		// Shrink the box back to the grid slot (lead stays hidden).
		tile.classList.add('is-traveling')
		const from = boxOf(tile)
		fadeBackdrop(false, CLOSE_MS)

		const settle = () => {
			teardown()
			close.remove()
			close.style.opacity = ''
			getBackdrop().style.opacity = ''
			tile.querySelector<HTMLElement>('[data-allergen-dialog]')?.setAttribute(
				'hidden',
				'',
			)
			tile.classList.remove('is-allergen-open')
			tile.querySelector<HTMLElement>('[data-gallery-dialog]')?.setAttribute(
				'hidden',
				'',
			)
			tile.classList.remove('is-gallery-open')
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
		}

		const shrink = travel(tile, from, to, CLOSE_MS)
		if (shrink) await waitAnim(shrink)
		settle()
	} finally {
		// Unlock as soon as the card is back in the grid — don't wait on
		// the title matrix so other cards can open immediately.
		closing = false
	}

	// Grid title matrix runs in the background.
	clearOpacity(scrollHint(tile))
	void decodeLead(tile, { cue: false })
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
