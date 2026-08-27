/**
 * Atmosphere entrance: desktop footer, or mobile screen 2 (video + hero).
 * Story now enters with the mobile home intro after the logo collapses.
 */

import { decodeHosts } from './matrix'
import { animationsEnabled, enableVideoToggle, videoEnabled } from './prefs'
import { boardIsMobile } from './layout'

const root = document.documentElement
const reduced = () => root.dataset.motion === 'reduce'

const VIDEO_TO_LEDE_MS = 160

let started = false
let running = false

function sleep(ms: number) {
	return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function video() {
	return document.querySelector<HTMLVideoElement>('#footer-video')
}

/** Atmosphere screen: desktop footer, or mobile mid page (video + hero). */
function onAtmosphere() {
	if (boardIsMobile()) return root.dataset.page === '1'
	return root.classList.contains('is-on-footer')
}

function syncVideo() {
	const el = video()
	if (!el) return

	const videoIn = root.classList.contains('is-footer-video-on')
	const canPlay = onAtmosphere() && videoIn && videoEnabled() && !reduced()

	if (canPlay) {
		void el.play().catch(() => {
			/* Autoplay can still be blocked; poster remains. */
		})
	} else {
		el.pause()
	}
}

function showFinal() {
	root.classList.add(
		'is-footer-video-on',
		'is-footer-brand-on',
		'is-footer-lede-body-on',
		'is-footer-revealed',
	)
	syncVideo()
}

async function decodeLede() {
	const hosts = [
		...document.querySelectorAll<HTMLElement>(
			'.footer-lede-title, .footer-lede-body',
		),
	]
	if (!hosts.length) return

	for (const host of hosts) host.classList.add('is-decoding')
	await decodeHosts(hosts)
	for (const host of hosts) host.classList.remove('is-decoding')
}

async function play() {
	if (started || running) return
	running = true
	root.classList.add('is-screen-animating')

	// Kitchen video fades in; lede matrix follows.
	root.classList.add('is-footer-video-on')
	syncVideo()

	await sleep(VIDEO_TO_LEDE_MS)
	root.classList.add('is-footer-brand-on', 'is-footer-lede-body-on')
	await sleep(40)
	await decodeLede()

	// Reveal the rest immediately — no post-matrix pause.
	root.classList.add('is-footer-revealed')

	started = true
	running = false
	root.classList.remove('is-screen-animating')
}

async function tryStart() {
	if (!onAtmosphere()) {
		syncVideo()
		return
	}
	if (started || running) {
		syncVideo()
		return
	}

	if (!animationsEnabled() || reduced()) {
		showFinal()
		started = true
		return
	}

	await play()
}

/** Kick the sequence the first time the visitor lands on the atmosphere screen. */
export function enableFooterReveal() {
	void tryStart()

	enableVideoToggle(() => {
		syncVideo()
	})

	const observer = new MutationObserver(() => {
		void tryStart()
	})
	observer.observe(root, { attributes: true, attributeFilter: ['data-page'] })

	document.addEventListener('visibilitychange', () => {
		if (document.hidden) video()?.pause()
		else syncVideo()
	})
}
