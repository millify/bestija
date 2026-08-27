/**
 * Mobile-only: after the full wordmark + subtitle, shrink the full company
 * name into a slim top header.
 *
 * Flight uses a fixed ghost (avoids in-place FLIP paint teleports). At the
 * end we hand off with a corrective transform so the real header mark sits
 * exactly where the ghost landed — no end-of-animation jump.
 */

const MOBILE_MQ = '(max-width: 899px)'
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

const root = document.documentElement

function logoSvg() {
	return document.querySelector<SVGSVGElement>('.tile--logo .logo')
}

function logoSub() {
	return document.querySelector<HTMLElement>('.tile--logo .logo-sub')
}

function prefersReduce() {
	return root.dataset.motion === 'reduce'
}

/** Two frames so layout + paint settle before measuring. */
function afterLayout() {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => resolve())
		})
	})
}

/** Fully drawn strokes — ghost must not replay the intro dash animation. */
function settleWordmark(svg: SVGElement) {
	svg.style.animation = 'none'
	svg.style.opacity = '1'
	for (const node of svg.querySelectorAll<SVGElement>('.wordmark > *')) {
		node.style.animation = 'none'
		node.style.strokeDasharray = 'none'
		node.style.strokeDashoffset = '0'
		node.style.opacity = '1'
	}
}

function clearInlineLogo(svg: SVGSVGElement) {
	svg.style.opacity = ''
	svg.style.visibility = ''
	svg.style.animation = ''
	svg.style.pointerEvents = ''
	svg.style.transform = ''
	svg.style.transformOrigin = ''
	svg.style.transition = ''
	svg.style.willChange = ''
}

function clearInlineSub(sub: HTMLElement | null) {
	if (!sub) return
	sub.style.opacity = ''
	sub.style.visibility = ''
	sub.style.animation = ''
	sub.style.pointerEvents = ''
}

/**
 * Hide the real mark during flight. Must kill `logo-show` — that animation
 * forces opacity:1 and would leave a duplicate waiting in the header.
 */
function hideRealMark(svg: SVGSVGElement, sub: HTMLElement | null) {
	svg.style.animation = 'none'
	svg.style.opacity = '0'
	svg.style.visibility = 'hidden'
	svg.style.pointerEvents = 'none'
	if (sub) {
		sub.style.animation = 'none'
		sub.style.opacity = '0'
		sub.style.visibility = 'hidden'
		sub.style.pointerEvents = 'none'
	}
}

function wipeGhosts() {
	document
		.querySelectorAll('.logo-ghost, .logo-sub-ghost')
		.forEach((node) => node.remove())
}

function pinFixed(
	el: HTMLElement | SVGElement,
	box: DOMRect,
	extra: Record<string, string> = {},
) {
	const styles: Record<string, string> = {
		position: 'fixed',
		left: `${box.left}px`,
		top: `${box.top}px`,
		width: `${box.width}px`,
		height: `${box.height}px`,
		margin: '0',
		zIndex: '200',
		pointerEvents: 'none',
		transformOrigin: 'center center',
		willChange: 'transform, opacity',
		backfaceVisibility: 'hidden',
		...extra,
	}
	el.style.cssText = Object.entries(styles)
		.map(([key, value]) => {
			const prop = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
			return `${prop}:${value}`
		})
		.join(';')
}

function centerDelta(from: DOMRect, to: DOMRect) {
	return {
		dx: to.left + to.width / 2 - (from.left + from.width / 2),
		dy: to.top + to.height / 2 - (from.top + from.height / 2),
		sx: to.width / Math.max(from.width, 0.001),
		sy: to.height / Math.max(from.height, 0.001),
	}
}

/** Settled compact header — used after the collapse animation or on skip. */
export function applyLogoCompact() {
	if (!window.matchMedia(MOBILE_MQ).matches) return
	wipeGhosts()
	const svg = logoSvg()
	root.classList.add('is-logo-compact')
	root.classList.remove('is-logo-collapsing')
	if (svg) clearInlineLogo(svg)
	clearInlineSub(logoSub())
}

/** Restore the full hero wordmark (desktop remount / breakpoint). */
export function resetLogoMark() {
	wipeGhosts()
	root.classList.remove('is-logo-compact', 'is-logo-collapsing')
	const svg = logoSvg()
	if (svg) clearInlineLogo(svg)
	clearInlineSub(logoSub())
}

/**
 * Fly the full wordmark into the header; the tagline moves with it and fades.
 * Resolves when cards can enter.
 */
export async function collapseLogoMark(durationMs = 1100): Promise<void> {
	if (!window.matchMedia(MOBILE_MQ).matches) return
	if (root.classList.contains('is-logo-compact')) return

	if (prefersReduce()) {
		applyLogoCompact()
		return
	}

	const svg = logoSvg()
	const sub = logoSub()
	if (!svg) {
		applyLogoCompact()
		return
	}

	await afterLayout()

	const first = svg.getBoundingClientRect()
	if (first.width < 2 || first.height < 2) {
		applyLogoCompact()
		return
	}

	const firstSub = sub?.getBoundingClientRect() ?? null

	// Mark ghost — covers the hero wordmark for the whole flight.
	const ghost = svg.cloneNode(true) as SVGSVGElement
	ghost.classList.add('logo-ghost')
	ghost.setAttribute('aria-hidden', 'true')
	ghost.removeAttribute('role')
	ghost.removeAttribute('aria-label')
	ghost.removeAttribute('width')
	ghost.removeAttribute('height')
	settleWordmark(ghost)
	pinFixed(ghost, first, {
		maxWidth: 'none',
		opacity: '1',
		animation: 'none',
	})
	document.body.appendChild(ghost)

	// Tagline ghost — rides upward with the mark and fades out mid-flight.
	let subGhost: HTMLElement | null = null
	if (sub && firstSub && firstSub.width > 1 && firstSub.height > 1) {
		subGhost = sub.cloneNode(true) as HTMLElement
		subGhost.classList.add('logo-sub-ghost')
		subGhost.setAttribute('aria-hidden', 'true')
		subGhost.style.animation = 'none'
		subGhost.style.opacity = '1'
		pinFixed(subGhost, firstSub, {
			display: 'block',
			textAlign: 'center',
			whiteSpace: 'nowrap',
			animation: 'none',
		})
		document.body.appendChild(subGhost)
	}

	// Only the ghosts are visible for the flight — never a second mark in the header.
	hideRealMark(svg, sub)

	root.classList.add('is-logo-collapsing', 'is-logo-compact')
	await afterLayout()

	let last = svg.getBoundingClientRect()
	if (last.width < 2 || last.height < 2) {
		wipeGhosts()
		clearInlineLogo(svg)
		clearInlineSub(sub)
		root.classList.remove('is-logo-collapsing')
		return
	}

	// Map the full first rect onto the compact rect (non-uniform scale =
	// exact handoff, avoids a 1px aspect mismatch jump).
	const { dx, dy, sx, sy } = centerDelta(first, last)
	const markFrom = 'translate3d(0, 0, 0) scale(1, 1)'
	const markTo = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`

	const flights: Promise<Animation>[] = [
		ghost.animate([{ transform: markFrom }, { transform: markTo }], {
			duration: durationMs,
			easing: EASING,
			fill: 'forwards',
		}).finished,
	]

	if (subGhost && firstSub) {
		flights.push(
			subGhost.animate(
				[
					{ transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
					{
						transform: `translate3d(${dx}px, ${dy * 0.92}px, 0) scale(0.72)`,
						opacity: 0,
						offset: 0.72,
					},
					{
						transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.55)`,
						opacity: 0,
					},
				],
				{
					duration: durationMs,
					easing: EASING,
					fill: 'forwards',
				},
			).finished,
		)
	}

	try {
		await Promise.all(flights)
	} catch {
		/* Interrupted — still settle into the compact header. */
	}

	// Let the last composited frame land before measuring the handoff.
	await afterLayout()

	// Mobile chrome toolbars can shift layout mid-flight — remeasure rest slot.
	last = svg.getBoundingClientRect()
	const landed = ghost.getBoundingClientRect()
	const target = landed.width > 1 ? landed : last

	// Reveal the real mark under the ghost, then pin it to the ghost’s pixels
	// so removing the ghost never flashes a different position.
	svg.style.animation = 'none'
	svg.style.visibility = 'visible'
	svg.style.opacity = '1'
	svg.style.pointerEvents = ''
	clearInlineSub(sub)

	await afterLayout()
	const real = svg.getBoundingClientRect()
	const fix = centerDelta(real, target)

	svg.style.transformOrigin = 'center center'
	svg.style.transition = 'none'
	svg.style.transform = `translate3d(${fix.dx}px, ${fix.dy}px, 0) scale(${fix.sx}, ${fix.sy})`

	wipeGhosts()
	root.classList.remove('is-logo-collapsing')

	// If we’re already on the rest slot, drop the pin. If layout drifted
	// (browser chrome, subpixels), keep the pin so the mark doesn’t jump.
	const aligned =
		Math.abs(fix.dx) < 0.5 &&
		Math.abs(fix.dy) < 0.5 &&
		Math.abs(fix.sx - 1) < 0.008 &&
		Math.abs(fix.sy - 1) < 0.008

	await afterLayout()
	if (aligned) {
		clearInlineLogo(svg)
	} else {
		svg.style.willChange = ''
	}
}
