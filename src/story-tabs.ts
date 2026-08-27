/**
 * About / Gallery tabs inside the expanded Our story card.
 */

export function enableStoryTabs() {
	const sheet = document.querySelector<HTMLElement>('.story-sheet')
	if (!sheet) return

	const tabs = [
		...sheet.querySelectorAll<HTMLButtonElement>('[data-story-tab]'),
	]
	const panels = [
		...sheet.querySelectorAll<HTMLElement>('[data-story-panel]'),
	]
	if (!tabs.length || !panels.length) return

	const select = (id: string) => {
		for (const tab of tabs) {
			const on = tab.dataset.storyTab === id
			tab.setAttribute('aria-selected', on ? 'true' : 'false')
			tab.tabIndex = on ? 0 : -1
		}
		for (const panel of panels) {
			panel.hidden = panel.dataset.storyPanel !== id
		}

		if (id !== 'gallery') {
			const tile = sheet.closest('.tile')
			tile
				?.querySelector<HTMLElement>('[data-gallery-dialog]')
				?.setAttribute('hidden', '')
			tile?.classList.remove('is-gallery-open')
		}

		// Keep the current scroll when possible. Only clamp if the new panel
		// is shorter and would leave us past the end (blank jump territory).
		const body = sheet.closest<HTMLElement>('.tile-body')
		requestAnimationFrame(() => {
			if (!body) return
			const max = Math.max(0, body.scrollHeight - body.clientHeight)
			if (body.scrollTop > max) body.scrollTop = max
		})
	}

	for (const tab of tabs) {
		tab.addEventListener('click', (event) => {
			event.preventDefault()
			event.stopPropagation()
			const id = tab.dataset.storyTab
			if (!id) return
			select(id)
		})
	}

	sheet
		.querySelector<HTMLElement>('.story-tabs')
		?.addEventListener('keydown', (event) => {
			const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
			if (!keys.includes(event.key)) return
			event.preventDefault()
			const i = tabs.findIndex(
				(t) => t.getAttribute('aria-selected') === 'true',
			)
			let next = i
			if (event.key === 'ArrowRight') next = (i + 1) % tabs.length
			if (event.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
			if (event.key === 'Home') next = 0
			if (event.key === 'End') next = tabs.length - 1
			const tab = tabs[next]
			const id = tab?.dataset.storyTab
			if (!tab || !id) return
			select(id)
			tab.focus()
		})
}
