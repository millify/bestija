/**
 * Mobile vs desktop board layout.
 *
 * Mobile (3 screens):
 *   0 — logo + menu + reservations (intro + scroll cue)
 *   1 — story + kitchen video + hero identity
 *   2 — visit · follow · motto/legal (one row each)
 *
 * Desktop keeps the home 2×2 grid and the full footer board.
 */

const MOBILE_MQ = '(max-width: 899px)'

let mode: 'mobile' | 'desktop' | null = null

function qs<T extends Element>(sel: string) {
	return document.querySelector<T>(sel)
}

function isMobile() {
	return window.matchMedia(MOBILE_MQ).matches
}

function applyLayout() {
	const next = isMobile() ? 'mobile' : 'desktop'
	if (next === mode) return
	mode = next

	const homeGrid = qs<HTMLElement>('#home-grid')
	const midGrid = qs<HTMLElement>('#mid-grid')
	const endGrid = qs<HTMLElement>('#end-grid')
	const footerGrid = qs<HTMLElement>('.footer-grid')
	const stage = qs<HTMLElement>('.ftile--stage')
	const footer = qs<HTMLElement>('#footer')
	const toggles = qs<HTMLElement>('#footer-toggles')
	const endShell = qs<HTMLElement>('#end .shell')

	const logo = qs<HTMLElement>('.tile--logo')
	const menu = qs<HTMLElement>('.tile--menu')
	const story = qs<HTMLElement>('.tile--story')
	const reservations = qs<HTMLElement>('.tile--reservations')
	const video = qs<HTMLElement>('.ftile--video')
	const identity = qs<HTMLElement>('.ftile--identity')
	const actions = qs<HTMLElement>('.ftile--actions')
	const visit = qs<HTMLElement>('.ftile--visit')
	const follow = qs<HTMLElement>('.ftile--follow')
	const bottom = qs<HTMLElement>('.ftile--bottom')

	if (
		!homeGrid ||
		!midGrid ||
		!endGrid ||
		!footerGrid ||
		!stage ||
		!footer ||
		!logo ||
		!menu ||
		!story ||
		!reservations ||
		!video ||
		!identity ||
		!actions ||
		!visit ||
		!follow ||
		!bottom
	) {
		return
	}

	if (next === 'mobile') {
		homeGrid.append(logo, menu, reservations)
		midGrid.append(story, video, identity)
		endGrid.append(visit, follow, bottom)
		if (toggles && endShell) endShell.prepend(toggles)
		document.documentElement.dataset.board = 'mobile'
	} else {
		homeGrid.append(logo, menu, story, reservations)
		actions.append(visit, follow)
		stage.append(video, identity)
		footerGrid.append(stage, actions, bottom)
		if (toggles) footer.insertBefore(toggles, footer.firstChild)
		document.documentElement.dataset.board = 'desktop'
	}
}

export function enableBoardLayout() {
	applyLayout()
	window.matchMedia(MOBILE_MQ).addEventListener('change', () => {
		mode = null
		applyLayout()
	})
}

export function boardIsMobile() {
	return document.documentElement.dataset.board === 'mobile'
}
