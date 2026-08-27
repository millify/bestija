/**
 * Book / Gift card tabs inside the expanded reservations card.
 */

export function enableReserveTabs() {
	const sheet = document.querySelector<HTMLElement>('.reserve-sheet')
	if (!sheet) return

	const tabs = [
		...sheet.querySelectorAll<HTMLButtonElement>('[data-reserve-tab]'),
	]
	const panels = [
		...sheet.querySelectorAll<HTMLElement>('[data-reserve-panel]'),
	]
	if (!tabs.length || !panels.length) return

	const select = (id: string) => {
		for (const tab of tabs) {
			const on = tab.dataset.reserveTab === id
			tab.setAttribute('aria-selected', on ? 'true' : 'false')
			tab.tabIndex = on ? 0 : -1
		}
		for (const panel of panels) {
			panel.hidden = panel.dataset.reservePanel !== id
		}

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
			const id = tab.dataset.reserveTab
			if (!id) return
			select(id)
		})
	}

	sheet
		.querySelector<HTMLElement>('.reserve-tabs')
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
			const id = tab?.dataset.reserveTab
			if (!tab || !id) return
			select(id)
			tab.focus()
		})
}
