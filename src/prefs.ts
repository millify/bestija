/**
 * Footer preference toggles — Animation + Video — persisted in localStorage.
 * Animation: checked (default) = play intros; unchecked = settled UI on load.
 * Video: checked (default) = play kitchen clip on the footer; unchecked = paused.
 */

const ANIM_KEY = 'bestija:animate'
const VIDEO_KEY = 'bestija:video'

export function animationsEnabled(): boolean {
	try {
		const stored = localStorage.getItem(ANIM_KEY)
		if (stored === null) return true
		return stored !== '0'
	} catch {
		return true
	}
}

export function setAnimationsEnabled(on: boolean) {
	try {
		localStorage.setItem(ANIM_KEY, on ? '1' : '0')
	} catch {
		/* ignore quota / private mode */
	}
}

export function videoEnabled(): boolean {
	try {
		const stored = localStorage.getItem(VIDEO_KEY)
		if (stored === null) return true
		return stored !== '0'
	} catch {
		return true
	}
}

export function setVideoEnabled(on: boolean) {
	try {
		localStorage.setItem(VIDEO_KEY, on ? '1' : '0')
	} catch {
		/* ignore quota / private mode */
	}
}

/** Wire the footer Animation checkbox to localStorage. */
export function enableAnimationToggle() {
	const input = document.querySelector<HTMLInputElement>('#anim-toggle')
	if (!input) return

	input.checked = animationsEnabled()
	input.addEventListener('change', () => {
		setAnimationsEnabled(input.checked)
	})
}

/** Wire the footer Video checkbox; optional callback runs after each change. */
export function enableVideoToggle(onChange?: (on: boolean) => void) {
	const input = document.querySelector<HTMLInputElement>('#video-toggle')
	if (!input) return

	input.checked = videoEnabled()
	input.addEventListener('change', () => {
		setVideoEnabled(input.checked)
		onChange?.(input.checked)
	})
}
