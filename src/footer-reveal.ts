/**
 * Atmosphere entrance: desktop footer, or mobile screen 2 (story + video + hero).
 * On mobile, the story card matrix-decodes here — not during the first-screen intro.
 */

import { decodeHosts } from './matrix'
import { animationsEnabled, enableVideoToggle, videoEnabled } from './prefs'
import { boardIsMobile } from './layout'

const root = document.documentElement
const reduced = () => root.dataset.motion === 'reduce'

const VIDEO_TO_LEDE_MS = 160
const BEFORE_REST_MS = 80
const STORY_MEDIA_TO_TEXT_MS = 340

let started = false
let running = false

function sleep(ms: number) {
	return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function video() {
	return document.querySelector<HTMLVideoElement>('#footer-video')
}

/** Atmosphere screen: desktop footer, or mobile mid page (story + video + hero). */
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
	const story = document.querySelector<HTMLElement>('.tile--story')
	if (story) {
		story.classList.add('is-tile-in', 'is-media-in', 'is-text-in', 'is-in')
		story.classList.remove('is-tile-in')
	}
	root.classList.add(
		'is-footer-video-on',
		'is-footer-brand-on',
		'is-footer-lede-body-on',
		'is-footer-revealed',
	)
	syncVideo()
}

async function revealStoryTile() {
	const story = document.querySelector<HTMLElement>('.tile--story')
	if (!story || story.classList.contains('is-text-in')) return

	const settle = (event: AnimationEvent) => {
		if (event.target !== story) return
		story.removeEventListener('animationend', settle)
		story.classList.add('is-in')
		story.classList.remove('is-tile-in')
	}
	story.addEventListener('animationend', settle)
	story.classList.add('is-tile-in', 'is-media-in')

	await sleep(STORY_MEDIA_TO_TEXT_MS)
	story.classList.add('is-text-in')

	const title = story.querySelector<HTMLElement>('h2')
	if (title) await decodeHosts([title])
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

	// Mobile screen 2: story card enters + decodes first.
	if (boardIsMobile()) {
		await revealStoryTile()
	}

	// Kitchen video fades in; lede matrix follows.
	root.classList.add('is-footer-video-on')
	syncVideo()

	await sleep(VIDEO_TO_LEDE_MS)
	root.classList.add('is-footer-brand-on', 'is-footer-lede-body-on')
	await sleep(40)
	await decodeLede()

	await sleep(BEFORE_REST_MS)
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
