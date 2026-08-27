/**
 * Animation + Video preferences.
 * Toggles are hidden for now — both stay on.
 */

const ANIM_KEY = 'bestija:animate'
const VIDEO_KEY = 'bestija:video'

export function animationsEnabled(): boolean {
	return true
}

export function setAnimationsEnabled(on: boolean) {
	try {
		localStorage.setItem(ANIM_KEY, on ? '1' : '0')
	} catch {
		/* ignore quota / private mode */
	}
}

export function videoEnabled(): boolean {
	return true
}

export function setVideoEnabled(on: boolean) {
	try {
		localStorage.setItem(VIDEO_KEY, on ? '1' : '0')
	} catch {
		/* ignore quota / private mode */
	}
}

/** Toggles are hidden — keep API so callers stay wired. */
export function enableAnimationToggle() {
	const input = document.querySelector<HTMLInputElement>('#anim-toggle')
	if (!input) return
	input.checked = true
}

/** Toggles are hidden — keep API so callers stay wired. */
export function enableVideoToggle(onChange?: (on: boolean) => void) {
	const input = document.querySelector<HTMLInputElement>('#video-toggle')
	if (!input) return
	input.checked = true
	onChange?.(true)
}
