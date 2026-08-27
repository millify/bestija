/**
 * Matrix-style decode used by the intro cards and the footer brand.
 * Two modes (shared with `?decode=`): world-script wipe, or cipher scramble.
 */

import { buildScripts, type WorldScript } from './glyphs'

const WORD_STEP = 40
const FOREIGN_MIN = 240
const FOREIGN_MAX = 560
const SCRIPT_INTERVAL = 165
const RESOLVE_STEP = 26
const SETTLE_MS = 560

const CIPHER_WIDE = [
	...'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&@$?><=+*',
	...'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω',
	...'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщ',
	...'אבגדהוזחטיכלמנסעפצקרשת',
	...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
	...'ԱԲԳԴԵԶԷԸԹԺԻԼԽԾԿՀՁՂՃՄՅՆՇՈՉՊՋՌՍՎՏՐՑՒՓՔՕՖ',
	...'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ',
	...'አበገደሀለመረሰተከወዘየፈፐሐኀዐጠጰጸፀ',
]
const CIPHER_NARROW = [...'1lit!|/\\:;.,\'()[]{}-_']
const CIPHER_CHAR_STEP = 9
const CIPHER_WINDOW = 850
const CIPHER_JITTER = 70
const CIPHER_FLIP = 45
const CIPHER_MIN = 220
const CIPHER_MAX = 460
const NARROW_WIDTH = 9

/** CJK / kana / hangul — kept in the mix, but shown less often than the rest. */
const EAST_ASIAN = new Set(['han', 'hiragana', 'katakana', 'hangul'])
const EAST_ASIAN_WEIGHT = 0.28
const WORLD_WEIGHT = 1

interface WordParts {
	el: HTMLElement
	chars: HTMLElement[]
}

interface HostState {
	html: string
	pending: number
}

interface WordUnit {
	kind: 'word'
	host: HTMLElement
	el: HTMLElement
	overlay: HTMLElement
	chars: HTMLElement[]
	offsets: number[]
	fontSize: number
	start: number
	resolveAt: number
	revealed: number
	paintedAt: number
	paintedBucket: number
	lastScript: WorldScript | null
	live: boolean
	done: boolean
}

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

interface Mark {
	at: number
	run: () => void
}

const randomOf = <T>(list: readonly T[]) =>
	list[(Math.random() * list.length) | 0]

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

/** Weighted pick so Greek, Cyrillic, Arabic, etc. show up as often as East Asian. */
function pickWorldScript(
	scripts: WorldScript[],
	avoid?: WorldScript | null,
): WorldScript {
	const pool = scripts.length > 1 && avoid
		? scripts.filter((script) => script !== avoid)
		: scripts
	const weights = pool.map((script) =>
		EAST_ASIAN.has(script.name) ? EAST_ASIAN_WEIGHT : WORLD_WEIGHT,
	)
	const total = weights.reduce((sum, weight) => sum + weight, 0)
	let roll = Math.random() * total
	for (let index = 0; index < pool.length; index += 1) {
		roll -= weights[index]
		if (roll <= 0) return pool[index]
	}
	return pool[pool.length - 1]
}

/**
 * Decodes one or more text hosts with the same matrix effect as the intro.
 * Resolves when every unit has settled and original HTML is restored.
 * Pass an `AbortSignal` to cancel early (HTML restored immediately).
 */
export function decodeHosts(
	hostsList: HTMLElement[],
	signal?: AbortSignal,
): Promise<void> {
	return new Promise((resolve) => {
		if (!hostsList.length || signal?.aborted) {
			resolve()
			return
		}

		const root = document.documentElement
		if (root.dataset.motion === 'reduce') {
			resolve()
			return
		}

		const units: Unit[] = []
		const marks: Mark[] = []
		const hosts = new Map<HTMLElement, HostState>()
		/** Original markup for every host — used on settle and on abort. */
		const originals = new Map<HTMLElement, string>()
		const t0 = performance.now()

		const sample = hostsList[0]
		const scripts = buildScripts(getComputedStyle(sample).fontFamily)
		const mode = scripts.length ? readMode() : 'cipher'

		for (const host of hostsList) {
			const html = host.innerHTML
			originals.set(host, html)
			const words = splitHost(host)
			if (!words.length) continue
			hosts.set(host, { html, pending: 0 })

			if (mode === 'world') {
				const fontSize = parseFloat(getComputedStyle(host).fontSize) || 16
				const measured = words.map(({ el, chars }) => {
					const box = el.getBoundingClientRect()
					const offsets = chars.map(
						(ch) => ch.getBoundingClientRect().left - box.left,
					)
					offsets.push(box.width)
					return { el, chars, offsets }
				})

				for (const [index, word] of measured.entries()) {
					const overlay = document.createElement('span')
					overlay.className = 'word-script'
					overlay.setAttribute('aria-hidden', 'true')
					word.el.appendChild(overlay)

					const at = index * WORD_STEP
					units.push({
						kind: 'word',
						host,
						el: word.el,
						overlay,
						chars: word.chars,
						offsets: word.offsets,
						fontSize,
						start: at,
						resolveAt:
							at + FOREIGN_MIN + Math.random() * (FOREIGN_MAX - FOREIGN_MIN),
						revealed: 0,
						paintedAt: -1,
						paintedBucket: -1,
						lastScript: null,
						live: false,
						done: false,
					})
				}
				const state = hosts.get(host)
				if (state) state.pending = measured.length
			} else {
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
						0,
						ratio * spread + (Math.random() - 0.5) * 2 * CIPHER_JITTER,
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
		}

		if (!units.length) {
			resolve()
			return
		}

		let settled = false
		const restoreAll = () => {
			for (const [host, html] of originals) host.innerHTML = html
		}

		const maybeDone = () => {
			if (settled) return
			if (units.some((u) => !u.done) || marks.length) return
			settled = true
			resolve()
		}

		const abort = () => {
			if (settled) return
			settled = true
			marks.length = 0
			restoreAll()
			resolve()
		}

		signal?.addEventListener('abort', abort, { once: true })

		const finish = (unit: Unit, at: number) => {
			unit.done = true
			const state = hosts.get(unit.host)
			if (state) {
				state.pending -= 1
				if (state.pending <= 0) {
					hosts.delete(unit.host)
					const target = unit.host
					const html = state.html
					marks.push({
						at: at + SETTLE_MS,
						run: () => {
							target.innerHTML = html
						},
					})
					marks.sort((a, b) => a.at - b.at)
				}
			}
		}

		const stepWord = (unit: WordUnit, t: number) => {
			if (t < unit.start) return
			if (!unit.live) {
				unit.live = true
				unit.el.classList.add('is-live')
			}

			const total = unit.chars.length
			const target =
				t < unit.resolveAt
					? 0
					: Math.min(
							total,
							Math.floor((t - unit.resolveAt) / RESOLVE_STEP) + 1,
						)

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

			const bucket = Math.floor(t / SCRIPT_INTERVAL)
			if (bucket === unit.paintedBucket && target === unit.paintedAt) return

			unit.paintedBucket = bucket
			unit.paintedAt = target
			const script = pickWorldScript(scripts, unit.lastScript)
			unit.lastScript = script
			unit.overlay.textContent = scriptRun(
				script,
				unit.offsets[total],
				unit.fontSize,
			)
		}

		const stepChar = (unit: CharUnit, t: number) => {
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

		const tick = (now: number) => {
			if (settled) return
			const t = now - t0
			while (marks.length && marks[0].at <= t) marks.shift()?.run()

			let pending = false
			for (const unit of units) {
				if (unit.done) continue
				pending = true
				if (unit.kind === 'word') stepWord(unit, t)
				else stepChar(unit, t)
			}

			if (settled) return
			if (pending || marks.length) requestAnimationFrame(tick)
			else maybeDone()
		}

		requestAnimationFrame(tick)
	})
}
