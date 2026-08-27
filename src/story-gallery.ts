/**
 * Our-story gallery lightbox — grid thumbs open a full-size modal
 * with prev/next and Escape to close (before the card itself closes).
 */

export function enableStoryGallery() {
	const tile = document.querySelector<HTMLElement>('.tile--story')
	if (!tile) return

	const dialog = tile.querySelector<HTMLElement>('[data-gallery-dialog]')
	const image = tile.querySelector<HTMLImageElement>('[data-gallery-image]')
	const caption = tile.querySelector<HTMLElement>('[data-gallery-caption]')
	const closeBtn = tile.querySelector<HTMLButtonElement>('[data-gallery-close]')
	const prevBtn = tile.querySelector<HTMLButtonElement>('[data-gallery-prev]')
	const nextBtn = tile.querySelector<HTMLButtonElement>('[data-gallery-next]')
	const items = [
		...tile.querySelectorAll<HTMLButtonElement>('[data-gallery-open]'),
	]
	if (
		!dialog ||
		!image ||
		!caption ||
		!closeBtn ||
		!prevBtn ||
		!nextBtn ||
		!items.length
	) {
		return
	}

	let index = 0
	let lastFocus: HTMLElement | null = null

	const show = (nextIndex: number) => {
		index = (nextIndex + items.length) % items.length
		const item = items[index]
		const thumb = item.querySelector('img')
		const src = thumb?.currentSrc || thumb?.src || ''
		const alt = thumb?.alt || ''
		if (!src) return
		image.src = src
		image.alt = alt
		caption.textContent = `${index + 1} / ${items.length}`
	}

	const close = () => {
		if (dialog.hidden) return
		dialog.hidden = true
		tile.classList.remove('is-gallery-open')
		image.removeAttribute('src')
		image.alt = ''
		caption.textContent = ''
		lastFocus?.focus?.({ preventScroll: true })
		lastFocus = null
	}

	const open = (nextIndex: number) => {
		lastFocus = document.activeElement as HTMLElement | null
		show(nextIndex)
		dialog.hidden = false
		tile.classList.add('is-gallery-open')
		closeBtn.focus({ preventScroll: true })
	}

	for (const item of items) {
		item.addEventListener('click', (event) => {
			event.preventDefault()
			event.stopPropagation()
			const raw = item.dataset.galleryIndex
			const parsed = raw == null ? 0 : Number.parseInt(raw, 10)
			open(Number.isFinite(parsed) ? parsed : items.indexOf(item))
		})
	}

	closeBtn.addEventListener('click', (event) => {
		event.preventDefault()
		event.stopPropagation()
		close()
	})

	prevBtn.addEventListener('click', (event) => {
		event.preventDefault()
		event.stopPropagation()
		show(index - 1)
	})

	nextBtn.addEventListener('click', (event) => {
		event.preventDefault()
		event.stopPropagation()
		show(index + 1)
	})

	dialog.addEventListener('click', (event) => {
		event.stopPropagation()
		if (event.target === dialog) close()
	})

	document.addEventListener(
		'keydown',
		(event) => {
			if (dialog.hidden) return
			if (event.key === 'Escape') {
				event.preventDefault()
				event.stopImmediatePropagation()
				close()
				return
			}
			if (event.key === 'ArrowLeft') {
				event.preventDefault()
				show(index - 1)
				return
			}
			if (event.key === 'ArrowRight') {
				event.preventDefault()
				show(index + 1)
			}
		},
		true,
	)
}
