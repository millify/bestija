/**
 * Menu allergen legend modal — opened from the sticky menu header
 * or the food-menu footer cue.
 */

export function enableMenuAllergens() {
	const tile = document.querySelector<HTMLElement>('.tile--menu')
	if (!tile) return

	const dialog = tile.querySelector<HTMLElement>('[data-allergen-dialog]')
	const openBtns = [
		...tile.querySelectorAll<HTMLButtonElement>('[data-allergen-open]'),
	]
	const closeBtn = tile.querySelector<HTMLButtonElement>('[data-allergen-close]')
	if (!dialog || !openBtns.length || !closeBtn) return

	let lastFocus: HTMLElement | null = null

	const close = () => {
		if (dialog.hidden) return
		dialog.hidden = true
		tile.classList.remove('is-allergen-open')
		lastFocus?.focus?.({ preventScroll: true })
		lastFocus = null
	}

	const open = () => {
		if (!dialog.hidden) return
		lastFocus = document.activeElement as HTMLElement | null
		dialog.hidden = false
		tile.classList.add('is-allergen-open')
		closeBtn.focus({ preventScroll: true })
	}

	for (const btn of openBtns) {
		btn.addEventListener('click', (event) => {
			event.preventDefault()
			event.stopPropagation()
			open()
		})
	}

	closeBtn.addEventListener('click', (event) => {
		event.preventDefault()
		event.stopPropagation()
		close()
	})

	dialog.addEventListener('click', (event) => {
		event.stopPropagation()
		if (event.target === dialog) close()
	})

	document.addEventListener(
		'keydown',
		(event) => {
			if (event.key !== 'Escape' || dialog.hidden) return
			event.preventDefault()
			event.stopImmediatePropagation()
			close()
		},
		true,
	)
}
