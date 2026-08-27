/**
 * Food / Wine / Drinks / Spirits tabs inside the expanded menu card.
 */

export function enableMenuTabs() {
	const sheet = document.querySelector<HTMLElement>('.menu-sheet')
	if (!sheet) return

	const tabs = [
		...sheet.querySelectorAll<HTMLButtonElement>('[data-menu-tab]'),
	]
	const panels = [
		...sheet.querySelectorAll<HTMLElement>('[data-menu-panel]'),
	]
	const allergenBtns = [
		...sheet.querySelectorAll<HTMLElement>('[data-allergen-open]'),
	]
	const chef = sheet.querySelector<HTMLElement>('.menu-chef')
	if (!tabs.length || !panels.length) return

	const select = (id: string) => {
		const isFood = id === 'food'

		for (const tab of tabs) {
			const on = tab.dataset.menuTab === id
			tab.setAttribute('aria-selected', on ? 'true' : 'false')
			tab.tabIndex = on ? 0 : -1
		}
		for (const panel of panels) {
			panel.hidden = panel.dataset.menuPanel !== id
		}
		for (const btn of allergenBtns) {
			// Footer cue lives in the food panel; only hide the sticky header control.
			if (btn.closest('.menu-head-trail')) btn.hidden = !isFood
		}
		if (chef) chef.hidden = !isFood
		if (!isFood) {
			const tile = sheet.closest('.tile')
			tile
				?.querySelector<HTMLElement>('[data-allergen-dialog]')
				?.setAttribute('hidden', '')
			tile?.classList.remove('is-allergen-open')
		}

		// New panel may be shorter — snap back under the sticky head.
		if (sheet.scrollHeight > sheet.clientHeight + 8) {
			sheet.scrollTo({ top: 0 })
		} else {
			const body = sheet.closest<HTMLElement>('.tile-body')
			body?.scrollTo({ top: sheet.offsetTop })
		}
	}

	for (const tab of tabs) {
		tab.addEventListener('click', (event) => {
			event.preventDefault()
			event.stopPropagation()
			const id = tab.dataset.menuTab
			if (!id) return
			select(id)
		})
	}

	sheet
		.querySelector<HTMLElement>('.menu-tabs')
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
			const id = tab?.dataset.menuTab
			if (!tab || !id) return
			select(id)
			tab.focus()
		})
}
