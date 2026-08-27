/**
 * After the last card finishes decoding, the scroll cue arrives as a mouse,
 * scrambles through glyphs, then settles into the double chevron.
 *
 * The same mouse → scramble → chevron beat is reused inside expanded cards
 * (`.scroll-hint-icon`) once the title/description matrix has settled.
 */

const GLYPHS = [
	...'アカサタナハマヤラワヲン一二三上下日月火水木金',
	...'⌬⎔⌇⌘◇○□△▽◈◉◎✶✸',
	...'01アイウエオキクケコ',
]

const MOUSE = `<svg class="scroll-cue-svg scroll-cue-svg--mouse" viewBox="0 0 24 24" aria-hidden="true">
  <rect x="8" y="2.5" width="8" height="14" rx="4"/>
  <line x1="12" y1="5.5" x2="12" y2="8.5"/>
  <path d="M9.5 18.5c.7.9 1.6 1.4 2.5 1.4s1.8-.5 2.5-1.4"/>
</svg>`

const CHEVRON = `<svg class="scroll-cue-svg scroll-cue-svg--chevron" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M6 8.5 12 14.5 18 8.5"/>
  <path d="M6 13.5 12 19.5 18 13.5"/>
</svg>`

const root = document.documentElement
const reduced = () => root.dataset.motion === 'reduce'
const pick = () => GLYPHS[(Math.random() * GLYPHS.length) | 0]

let started = false

function show(cue: HTMLElement, html: string) {
	cue.innerHTML = html
}

function settleHost(host: HTMLElement) {
	show(host, CHEVRON)
	host.classList.remove('is-mouse', 'is-scrambling')
	host.classList.add('is-live', 'is-settled')
}

/**
 * Mouse → glyph scramble → double chevron on any host (homepage cue or
 * in-card scroll hint). Honors AbortSignal so card close can cancel mid-flight.
 */
export function playIconCue(
	host: HTMLElement,
	signal?: AbortSignal,
): Promise<void> {
	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve()
			return
		}

		let delayId = 0
		let tickId = 0
		const clear = () => {
			if (delayId) window.clearTimeout(delayId)
			if (tickId) window.clearInterval(tickId)
			delayId = 0
			tickId = 0
		}

		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			clear()
			resolve()
		}

		const onAbort = () => {
			clear()
			settleHost(host)
			finish()
		}

		signal?.addEventListener('abort', onAbort, { once: true })

		host.classList.add('is-live')
		host.classList.remove('is-mouse', 'is-scrambling', 'is-settled')

		if (reduced()) {
			settleHost(host)
			finish()
			return
		}

		show(host, MOUSE)
		host.classList.add('is-mouse')

		delayId = window.setTimeout(() => {
			if (signal?.aborted) return
			host.classList.remove('is-mouse')
			host.classList.add('is-scrambling')

			let flips = 0
			const maxFlips = 12
			tickId = window.setInterval(() => {
				if (signal?.aborted) {
					clear()
					return
				}
				show(
					host,
					`<span class="scroll-cue-glyph" aria-hidden="true">${pick()}</span>`,
				)
				flips += 1
				if (flips < maxFlips) return

				clear()
				settleHost(host)
				finish()
			}, 50)
		}, 520)
	})
}

/** Reset an in-card icon host before the next open. */
export function resetIconCue(host: HTMLElement | null) {
	if (!host) return
	host.innerHTML = ''
	host.classList.remove('is-live', 'is-mouse', 'is-scrambling', 'is-settled')
}

export function revealScrollCue() {
	const cue = document.getElementById('scroll-cue')
	if (!cue || started) return
	started = true

	void playIconCue(cue)
}

/** Final chevron state with no mouse/scramble prelude. */
export function settleScrollCue() {
	const cue = document.getElementById('scroll-cue')
	if (!cue) return
	started = true
	settleHost(cue)
}
