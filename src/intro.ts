import { buildScripts, type WorldScript } from './glyphs'
import { revealScrollCue, settleScrollCue } from './scroll-cue'
import { boardIsMobile } from './layout'
import { animationsEnabled } from './prefs'

/**
 * Staged intro: the wordmark draws on the page, then each content card flies in
 * one at a time and decodes its copy.
 *
 * Two decode styles, switchable with `?decode=`:
 *   world  — every word arrives as a run of world scripts, then settles into
 *            English letter by letter (default)
 *   cipher — per-glyph symbol scramble
 */

/** Milliseconds from page load until the wordmark has finished drawing. */
const CONTENT_START = 2200
const TILE_STEP = 200
const MEDIA_TO_TEXT = 340
/** Each text block starts after the previous one in the same card. */
const HOST_STEP = 130

const WORD_STEP = 40
const FOREIGN_MIN = 240
const FOREIGN_MAX = 560
/** How long a single writing system stays on screen. */
const SCRIPT_INTERVAL = 165
const RESOLVE_STEP = 26
const SETTLE_MS = 560

const CIPHER_WIDE = [
	...'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$?><=+*アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン',
]
const CIPHER_NARROW = [...'1lit!|/\\:;.,\'()[]{}-_']
const CIPHER_CHAR_STEP = 9
const CIPHER_WINDOW = 850
const CIPHER_JITTER = 70
const CIPHER_FLIP = 45
const CIPHER_MIN = 220
const CIPHER_MAX = 460
/** Glyphs below this width get a narrow pool so swaps stay inside their slot. */
const NARROW_WIDTH = 9

const TEXT_SELECTOR = 'h2'

interface Mark {
	at: number
	run: () => void
}

interface HostState {
	html: string
	pending: number
}

/** A word that morphs through world scripts before resolving to English. */
interface WordUnit {
	kind: 'word'
	host: HTMLElement
	el: HTMLElement
	overlay: HTMLElement
	chars: HTMLElement[]
	/** Left edge of each character, plus the word width at the end. */
	offsets: number[]
	fontSize: number
	start: number
	resolveAt: number
	revealed: number
	paintedAt: number
	paintedScript: number
	live: boolean
	done: boolean
}

/** A single character flickering through cipher symbols. */
interface CharUnit {
	kind: 'char'
	host: HTMLElement
	el: HTMLElement
	final: string
	pool: readonly string[]
	start: number
	end: number
	live: boolean
	done: boolean
	lastFlip: number
}

type Unit = WordUnit | CharUnit

interface WordParts {
	el: HTMLElement
	chars: HTMLElement[]
}

const pageStart = performance.now()
const root = document.documentElement
const units: Unit[] = []
const marks: Mark[] = []
const hosts = new Map<HTMLElement, HostState>()

let scripts: WorldScript[] = []

const randomOf = <T>(list: readonly T[]) =>
	list[(Math.random() * list.length) | 0]

const isVisible = (el: HTMLElement) => el.getClientRects().length > 0

/** First-screen cards only on mobile; full gallery on desktop. */
function contentTiles() {
	const tiles = [
		...document.querySelectorAll<HTMLElement>('.tile:not(.tile--logo)'),
	]
	if (boardIsMobile()) {
		return tiles.filter((tile) => !tile.classList.contains('tile--story'))
	}
	return tiles
}

function revealInstantly(tile: HTMLElement) {
	flyIn(tile)
	tile.classList.add('is-media-in', 'is-text-in')
}

/**
 * Swaps the entrance class for a static one when the fly-in ends, so a tile
 * that later gets re-parented (see expand.ts) can't replay it.
 */
function flyIn(tile: HTMLElement) {
	const settle = (event: AnimationEvent) => {
		if (event.target !== tile) return
		tile.removeEventListener('animationend', settle)
		tile.classList.add('is-in')
		tile.classList.remove('is-tile-in')
	}
	tile.addEventListener('animationend', settle)
	tile.classList.add('is-tile-in')
}

function readMode(): 'world' | 'cipher' {
	let stored: string | null = null
	try {
		const asked = new URLSearchParams(location.search).get('decode')
		if (asked) localStorage.setItem('bestija:decode', asked)
		stored = localStorage.getItem('bestija:decode')
	} catch {
		stored = null
	}
	return stored === 'cipher' ? 'cipher' : 'world'
}

/**
 * Wraps every word and character in spans so text can be recomposed without
 * reflowing the line. Nodes such as `<br>` are left untouched.
 */
function splitHost(host: HTMLElement): WordParts[] {
	const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
	const textNodes: Text[] = []
	while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

	const words: WordParts[] = []
	for (const node of textNodes) {
		const raw = node.nodeValue ?? ''
		if (!raw.trim()) continue

		const frag = document.createDocumentFragment()
		for (const token of raw.split(/(\s+)/)) {
			if (!token) continue
			if (/^\s+$/.test(token)) {
				frag.appendChild(document.createTextNode(' '))
				continue
			}

			const el = document.createElement('span')
			el.className = 'word'
			const chars: HTMLElement[] = []
			for (const char of token) {
				const charEl = document.createElement('span')
				charEl.className = 'ch'
				charEl.textContent = char
				el.appendChild(charEl)
				chars.push(charEl)
			}
			frag.appendChild(el)
			words.push({ el, chars })
		}
		node.parentNode?.replaceChild(frag, node)
	}
	return words
}

function scriptRun(script: WorldScript, width: number, fontSize: number) {
	const glyph = script.em * fontSize
	const count = Math.max(1, Math.round(width / glyph))
	let out = ''
	for (let index = 0; index < count; index += 1) out += randomOf(script.chars)
	return out
}

function buildWordUnits(host: HTMLElement, words: WordParts[], start: number) {
	const fontSize = parseFloat(getComputedStyle(host).fontSize) || 16

	const measured = words.map(({ el, chars }) => {
		const box = el.getBoundingClientRect()
		const offsets = chars.map((ch) => ch.getBoundingClientRect().left - box.left)
		offsets.push(box.width)
		return { el, chars, offsets }
	})

	for (const [index, word] of measured.entries()) {
		const overlay = document.createElement('span')
		overlay.className = 'word-script'
		overlay.setAttribute('aria-hidden', 'true')
		word.el.appendChild(overlay)

		const at = start + index * WORD_STEP
		units.push({
			kind: 'word',
			host,
			el: word.el,
			overlay,
			chars: word.chars,
			offsets: word.offsets,
			fontSize,
			start: at,
			resolveAt: at + FOREIGN_MIN + Math.random() * (FOREIGN_MAX - FOREIGN_MIN),
			revealed: 0,
			paintedAt: -1,
			paintedScript: -1,
			live: false,
			done: false,
		})
	}

	const state = hosts.get(host)
	if (state) state.pending = measured.length
}

function buildCharUnits(host: HTMLElement, words: WordParts[], start: number) {
	const chars = words.flatMap((word) => word.chars)
	const widths = chars.map((el) => el.getBoundingClientRect().width)

	chars.forEach((el, index) => {
		el.classList.add('is-fixed')
		el.style.width = `${widths[index].toFixed(2)}px`
	})

	const spread = Math.min(chars.length * CIPHER_CHAR_STEP, CIPHER_WINDOW)
	chars.forEach((el, index) => {
		const ratio = chars.length > 1 ? index / (chars.length - 1) : 0
		const at = Math.max(
			start,
			start + ratio * spread + (Math.random() - 0.5) * 2 * CIPHER_JITTER,
		)
		units.push({
			kind: 'char',
			host,
			el,
			final: el.textContent ?? '',
			pool: widths[index] < NARROW_WIDTH ? CIPHER_NARROW : CIPHER_WIDE,
			start: at,
			end: at + CIPHER_MIN + Math.random() * (CIPHER_MAX - CIPHER_MIN),
			live: false,
			done: false,
			lastFlip: -Infinity,
		})
	})

	const state = hosts.get(host)
	if (state) state.pending = chars.length
}

/** Puts the untouched markup back so final typography keeps its native shaping. */
function finish(unit: Unit, at: number) {
	unit.done = true

	const state = hosts.get(unit.host)
	if (state) {
		state.pending -= 1
		if (state.pending <= 0) {
			hosts.delete(unit.host)
			const target = unit.host
			const html = state.html
			marks.push({ at: at + SETTLE_MS, run: () => (target.innerHTML = html) })
			marks.sort((a, b) => a.at - b.at)
		}
	}

	// As soon as the last glyph resolves, kick the scroll-cue sequence —
	// don't wait for HTML settle marks or the unlock buffer.
	if (units.length > 0 && units.every((entry) => entry.done)) {
		onMatrixComplete()
	}
}

let matrixComplete = false

/** Fires once when every decode unit has settled into English. */
function onMatrixComplete() {
	if (matrixComplete) return
	matrixComplete = true
	revealScrollCue()
	// Unlock paging with the cue so the hint and scroll arrive together.
	if (root.classList.contains('is-intro')) {
		root.classList.remove('is-intro')
		root.classList.add('intro-done')
	}
}

function stepWord(unit: WordUnit, t: number) {
	if (t < unit.start) return
	if (!unit.live) {
		unit.live = true
		unit.el.classList.add('is-live')
	}

	const total = unit.chars.length
	const target =
		t < unit.resolveAt
			? 0
			: Math.min(total, Math.floor((t - unit.resolveAt) / RESOLVE_STEP) + 1)

	if (target !== unit.revealed) {
		for (let index = unit.revealed; index < target; index += 1) {
			unit.chars[index].classList.add('is-on')
		}
		unit.revealed = target
		unit.overlay.style.clipPath = `inset(0 0 0 ${unit.offsets[target]}px)`
	}

	if (target >= total) {
		unit.overlay.remove()
		finish(unit, t)
		return
	}

	const index = Math.floor(t / SCRIPT_INTERVAL) % scripts.length
	if (index === unit.paintedScript && target === unit.paintedAt) return

	unit.paintedScript = index
	unit.paintedAt = target
	unit.overlay.textContent = scriptRun(
		scripts[index],
		unit.offsets[total],
		unit.fontSize,
	)
}

function stepChar(unit: CharUnit, t: number) {
	if (t < unit.start) return
	if (!unit.live) {
		unit.live = true
		unit.el.classList.add('is-scramble')
	}

	if (t >= unit.end) {
		unit.el.textContent = unit.final
		unit.el.classList.remove('is-scramble')
		unit.el.classList.add('is-on')
		finish(unit, t)
		return
	}

	if (t - unit.lastFlip < CIPHER_FLIP) return
	unit.lastFlip = t
	unit.el.textContent = randomOf(unit.pool)
}

function tick(now: number) {
	const t = now - pageStart

	while (marks.length && marks[0].at <= t) marks.shift()?.run()

	let pending = false
	for (const unit of units) {
		if (unit.done) continue
		pending = true
		if (unit.kind === 'word') stepWord(unit, t)
		else stepChar(unit, t)
	}

	if (pending || marks.length) requestAnimationFrame(tick)
	else finishIntro()
}

/** Fallback unlock when there was no glyph decode (or reduced motion). */
function finishIntro() {
	if (!root.classList.contains('is-intro')) return
	onMatrixComplete()
}

function begin() {
	const tiles = contentTiles()

	// Resolved before first paint by the inline head script.
	if (root.dataset.motion === 'reduce') {
		tiles.forEach((tile, index) => {
			setTimeout(() => revealInstantly(tile), CONTENT_START + index * TILE_STEP)
		})
		const lastAt = CONTENT_START + Math.max(0, tiles.length - 1) * TILE_STEP
		setTimeout(finishIntro, lastAt + 700)
		return
	}

	const visible = tiles.filter(isVisible)
	const sample = document.querySelector<HTMLElement>('.tile h2')
	scripts = sample ? buildScripts(getComputedStyle(sample).fontFamily) : []
	const mode = scripts.length ? readMode() : 'cipher'

	// If webfonts were slow, start from now so the sequence never plays out
	// half-finished in a single frame.
	const base = Math.max(CONTENT_START, performance.now() - pageStart + 120)

	// Split every card first, then measure once, to keep layout work in one pass.
	const planned = visible.flatMap((tile, tileIndex) => {
		const textAt = base + tileIndex * TILE_STEP + MEDIA_TO_TEXT
		const targets = [...tile.querySelectorAll<HTMLElement>(TEXT_SELECTOR)]

		let hostIndex = 0
		return targets.filter(isVisible).flatMap((host) => {
			const html = host.innerHTML
			const words = splitHost(host)
			if (!words.length) return []

			hosts.set(host, { html, pending: 0 })
			const at = textAt + hostIndex * HOST_STEP
			hostIndex += 1
			return [{ host, words, at }]
		})
	})

	visible.forEach((tile, index) => {
		const mediaAt = base + index * TILE_STEP
		marks.push({
			at: mediaAt,
			run: () => {
				flyIn(tile)
				tile.classList.add('is-media-in')
			},
		})
		marks.push({
			at: mediaAt + MEDIA_TO_TEXT,
			run: () => tile.classList.add('is-text-in'),
		})
	})

	for (const { host, words, at } of planned) {
		if (mode === 'world') buildWordUnits(host, words, at)
		else buildCharUnits(host, words, at)
	}

	marks.sort((a, b) => a.at - b.at)
	requestAnimationFrame(tick)
}

/** A tile revealed by a viewport change mid-intro never gets to decode. */
function watchLayout() {
	window.matchMedia('(min-width: 900px)').addEventListener('change', () => {
		for (const tile of document.querySelectorAll<HTMLElement>(
			'.tile:not(.tile--logo)',
		)) {
			if (!tile.classList.contains('is-text-in')) revealInstantly(tile)
		}
	})
}

export function startIntro() {
	root.classList.add('seq-ready')
	window.scrollTo(0, 0)

	if (!animationsEnabled()) {
		skipIntro()
		return
	}

	root.classList.add('is-intro')
	watchLayout()

	// Glyph metrics are measured in pixels, so wait for webfonts to land.
	Promise.race([
		document.fonts?.ready ?? Promise.resolve(),
		new Promise((resolve) => setTimeout(resolve, 1500)),
	]).then(begin)
}

/** Jump to the settled gallery when entrance animation is turned off. */
function skipIntro() {
	const tiles = contentTiles()
	for (const tile of tiles) {
		revealInstantly(tile)
		tile.classList.add('is-in')
		tile.classList.remove('is-tile-in')
	}

	root.classList.remove('is-intro')
	root.classList.add('intro-done')
	settleScrollCue()
}
