/**
 * Footer entrance: as soon as the visitor flips to the footer screen, fade
 * in the kitchen video and matrix-decode the hero lede, then quickly bring
 * in Michelin, Visit/Follow, and the bottom bar. Plays / pauses the
 * atmosphere video with the footer screen.
 */

import { decodeHosts } from './matrix'
import { animationsEnabled, enableVideoToggle, videoEnabled } from './prefs'

const root = document.documentElement
const reduced = () => root.dataset.motion === 'reduce'

/**
 * Start the lede decode while the video is still fading in, so the two
 * read as one beat rather than waiting for the full video opacity settle.
 */
const VIDEO_TO_LEDE_MS = 160
/** Breath after the lede lands before Michelin / Visit / legal appear. */
const BEFORE_REST_MS = 80

let started = false
let running = false

function sleep(ms: number) {
	return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function video() {
	return document.querySelector<HTMLVideoElement>('#footer-video')
}

function syncVideo() {
	const el = video()
	if (!el) return

	const onFooter = root.dataset.page === '1'
	const videoIn = root.classList.contains('is-footer-video-on')
	const canPlay = onFooter && videoIn && videoEnabled() && !reduced()

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

	// 1) Kitchen video starts fading in immediately with the page flip.
	root.classList.add('is-footer-video-on')
	syncVideo()

	// 2) Lede matrix picks up mid-fade — title + description together.
	await sleep(VIDEO_TO_LEDE_MS)
	root.classList.add('is-footer-brand-on', 'is-footer-lede-body-on')
	await sleep(40)
	await decodeLede()

	// 3) Michelin, Visit/Follow, and bottom bar — quick follow-on.
	await sleep(BEFORE_REST_MS)
	root.classList.add('is-footer-revealed')

	started = true
	running = false
}

async function tryStart() {
	if (root.dataset.page !== '1') {
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

	// Fire as soon as we land on the footer — no wait for the flip to finish.
	await play()
}

/** Kick the sequence the first time the visitor lands on the footer screen. */
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
