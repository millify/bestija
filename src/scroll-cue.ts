/**
 * After the last card finishes decoding, the scroll cue arrives as a mouse,
 * scrambles through glyphs, then settles into the double chevron.
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

export function revealScrollCue() {
	const cue = document.getElementById('scroll-cue')
	if (!cue || started) return
	started = true

	cue.classList.add('is-live')

	if (reduced()) {
		show(cue, CHEVRON)
		cue.classList.add('is-settled')
		return
	}

	// 1) Mouse lands — the “you can scroll” hint in its first form.
	show(cue, MOUSE)
	cue.classList.add('is-mouse')

	window.setTimeout(() => {
		cue.classList.remove('is-mouse')
		cue.classList.add('is-scrambling')

		// 2) Matrix flash through foreign glyphs.
		let flips = 0
		const maxFlips = 12
		const tick = window.setInterval(() => {
			show(cue, `<span class="scroll-cue-glyph" aria-hidden="true">${pick()}</span>`)
			flips += 1
			if (flips < maxFlips) return

			window.clearInterval(tick)
			// 3) Settle into the double chevron.
			show(cue, CHEVRON)
			cue.classList.remove('is-scrambling')
			cue.classList.add('is-settled')
		}, 50)
	}, 520)
}
