type Step = 'slot' | 'confirm' | 'details' | 'done'

type State = {
	party: number
	date: string
	time: string | null
	earliest: string
}

const TIME_START = 12 * 60
const TIME_END = 20 * 60 + 15 // 8:15 pm last seating
const TIME_STEP = 15
const SEATING_MINUTES = 90
const PARTY_MIN = 2
const PARTY_MAX = 50

function pad(n: number) {
	return String(n).padStart(2, '0')
}

function toISODate(d: Date) {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Next open service day (house closed Mondays). */
function earliestOpenDate(from = new Date()) {
	const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
	for (let i = 0; i < 14; i++) {
		if (d.getDay() !== 1) return toISODate(d)
		d.setDate(d.getDate() + 1)
	}
	return toISODate(d)
}

function parseISODate(iso: string) {
	const [y, m, day] = iso.split('-').map(Number)
	return new Date(y, m - 1, day)
}

function formatLongDate(iso: string) {
	const d = parseISODate(iso)
	return d.toLocaleDateString('en-GB', {
		weekday: 'short',
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	})
}

function formatTime(minutes: number) {
	const h = Math.floor(minutes / 60)
	const m = minutes % 60
	const suffix = h >= 12 ? 'pm' : 'am'
	const hour12 = h % 12 || 12
	return `${pad(hour12)}:${pad(m)} ${suffix}`
}

function parseTimeLabel(label: string) {
	const match = label.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
	if (!match) return 0
	let h = Number(match[1])
	const m = Number(match[2])
	const ap = match[3].toLowerCase()
	if (ap === 'pm' && h !== 12) h += 12
	if (ap === 'am' && h === 12) h = 0
	return h * 60 + m
}

function partyLabel(n: number) {
	return n === 1 ? '1 person' : `${n} people`
}

function buildSlots() {
	const slots: string[] = []
	for (let t = TIME_START; t <= TIME_END; t += TIME_STEP) {
		slots.push(formatTime(t))
	}
	return slots
}

function summaryLine(state: State) {
	if (!state.time) return ''
	const start = parseTimeLabel(state.time)
	const end = formatTime(start + SEATING_MINUTES)
	return `${partyLabel(state.party)}, ${formatLongDate(state.date)}, ${state.time} – ${end}`
}

function confirmCopy(state: State) {
	const when = formatLongDate(state.date)
	const who = partyLabel(state.party)
	if (state.date === state.earliest) {
		return `Your reservation for ${who} will be scheduled for ${when}. It’s the earliest available date.`
	}
	return `Your reservation for ${who} will be scheduled for ${when}${state.time ? ` at ${state.time}` : ''}.`
}

export function enableReservations() {
	const root = document.querySelector<HTMLElement>('[data-reserve-root]')
	if (!root) return

	const pickRow = root.querySelector<HTMLElement>('[data-reserve-pick]')
	const partyEl = root.querySelector<HTMLSelectElement>('[data-reserve-party]')
	const dateEl = root.querySelector<HTMLInputElement>('[data-reserve-date]')
	const timesEl = root.querySelector<HTMLElement>('[data-reserve-times]')
	const actionsEl = root.querySelector<HTMLElement>('[data-reserve-actions]')
	const nextBtn = root.querySelector<HTMLButtonElement>('[data-reserve-next]')
	const confirmCancelBtn = root.querySelector<HTMLButtonElement>(
		'[data-reserve-confirm-cancel]',
	)
	const confirmOkBtn = root.querySelector<HTMLButtonElement>('[data-reserve-confirm-ok]')
	const backBtn = root.querySelector<HTMLButtonElement>('[data-reserve-back]')
	const submitBtn = root.querySelector<HTMLButtonElement>('[data-reserve-submit]')
	const resetBtn = root.querySelector<HTMLButtonElement>('[data-reserve-reset]')
	const form = root.querySelector<HTMLFormElement>('[data-reserve-form]')
	const summaryEl = root.querySelector<HTMLElement>('[data-reserve-summary]')
	const confirmCopyEl = root.querySelector<HTMLElement>('[data-reserve-confirm-copy]')

	if (
		!pickRow ||
		!partyEl ||
		!dateEl ||
		!timesEl ||
		!actionsEl ||
		!nextBtn ||
		!confirmCancelBtn ||
		!confirmOkBtn ||
		!backBtn ||
		!submitBtn ||
		!resetBtn ||
		!form ||
		!summaryEl ||
		!confirmCopyEl
	) {
		return
	}

	const state: State = {
		party: Number(partyEl.value) || 2,
		date: earliestOpenDate(),
		time: null,
		earliest: earliestOpenDate(),
	}

	const partyShell = root.querySelector<HTMLElement>('[data-reserve-party-shell]')
	const dateShell = root.querySelector<HTMLElement>('[data-reserve-date-shell]')

	const openPicker = (el: HTMLSelectElement | HTMLInputElement) => {
		el.focus({ preventScroll: true })
		const picker = el as HTMLSelectElement & { showPicker?: () => void }
		try {
			picker.showPicker?.()
		} catch {
			/* showPicker can throw if not triggered by user gesture in some engines */
		}
	}

	partyShell?.addEventListener('pointerdown', (event) => {
		if (event.target === partyEl) return
		event.preventDefault()
		openPicker(partyEl)
	})

	dateShell?.addEventListener('pointerdown', (event) => {
		if (event.target === dateEl) return
		event.preventDefault()
		openPicker(dateEl)
	})

	partyEl.addEventListener('click', () => openPicker(partyEl))
	dateEl.addEventListener('click', () => openPicker(dateEl))

	dateEl.min = state.earliest
	dateEl.value = state.date

	partyEl.replaceChildren(
		...Array.from({ length: PARTY_MAX - PARTY_MIN + 1 }, (_, i) => {
			const n = PARTY_MIN + i
			const opt = document.createElement('option')
			opt.value = String(n)
			opt.textContent = partyLabel(n)
			if (n === 2) opt.selected = true
			return opt
		}),
	)

	const timesShell = timesEl.closest<HTMLElement>('.reserve-times-shell')
	const timesRail = root.querySelector<HTMLElement>('[data-reserve-times-rail]')
	const timesThumb = root.querySelector<HTMLElement>('[data-reserve-times-thumb]')

	const syncTimesScroll = () => {
		if (!timesShell || !timesRail || !timesThumb) return
		const view = timesEl.clientHeight
		const full = timesEl.scrollHeight
		const overflow = full > view + 1
		timesShell.classList.toggle('is-scrollable', overflow)
		if (!overflow) {
			timesThumb.style.height = '100%'
			timesThumb.style.transform = 'translateY(0)'
			return
		}
		const railH = timesRail.clientHeight
		const thumbH = Math.max(28, (view / full) * railH)
		const maxTop = Math.max(0, railH - thumbH)
		const maxScroll = Math.max(1, full - view)
		const top = (timesEl.scrollTop / maxScroll) * maxTop
		timesThumb.style.height = `${thumbH}px`
		timesThumb.style.transform = `translateY(${top}px)`
	}

	timesEl.addEventListener('scroll', syncTimesScroll, { passive: true })
	addEventListener('resize', syncTimesScroll)
	if (typeof ResizeObserver !== 'undefined') {
		new ResizeObserver(syncTimesScroll).observe(timesEl)
	}

	if (timesRail && timesThumb) {
		let dragging = false
		let dragOffset = 0

		const scrollFromPointer = (clientY: number) => {
			const railH = timesRail.clientHeight
			const thumbH = timesThumb.offsetHeight
			const maxTop = Math.max(0, railH - thumbH)
			const rect = timesRail.getBoundingClientRect()
			const y = Math.min(
				maxTop,
				Math.max(0, clientY - rect.top - dragOffset),
			)
			const maxScroll = Math.max(1, timesEl.scrollHeight - timesEl.clientHeight)
			timesEl.scrollTop = maxTop > 0 ? (y / maxTop) * maxScroll : 0
		}

		timesRail.addEventListener('pointerdown', (event) => {
			if (!timesShell?.classList.contains('is-scrollable')) return
			event.preventDefault()
			const thumbRect = timesThumb.getBoundingClientRect()
			const onThumb =
				event.target === timesThumb || timesThumb.contains(event.target as Node)
			dragOffset = onThumb ? event.clientY - thumbRect.top : timesThumb.offsetHeight / 2
			dragging = true
			timesThumb.classList.add('is-dragging')
			timesRail.setPointerCapture(event.pointerId)
			scrollFromPointer(event.clientY)
		})

		timesRail.addEventListener('pointermove', (event) => {
			if (!dragging) return
			scrollFromPointer(event.clientY)
		})

		const endDrag = (event: PointerEvent) => {
			if (!dragging) return
			dragging = false
			timesThumb.classList.remove('is-dragging')
			try {
				timesRail.releasePointerCapture(event.pointerId)
			} catch {
				/* already released */
			}
		}

		timesRail.addEventListener('pointerup', endDrag)
		timesRail.addEventListener('pointercancel', endDrag)
	}

	const slots = buildSlots()
	timesEl.replaceChildren(
		...slots.map((label) => {
			const btn = document.createElement('button')
			btn.type = 'button'
			btn.className = 'reserve-time'
			btn.setAttribute('role', 'option')
			btn.setAttribute('aria-selected', 'false')
			btn.textContent = label
			btn.addEventListener('click', () => {
				state.time = label
				for (const other of timesEl.querySelectorAll('.reserve-time')) {
					other.classList.toggle('is-selected', other === btn)
					other.setAttribute(
						'aria-selected',
						other === btn ? 'true' : 'false',
					)
				}
				nextBtn.disabled = false
				nextBtn.classList.add('is-ready')
			})
			return btn
		}),
	)

	requestAnimationFrame(syncTimesScroll)

	const syncSummary = () => {
		summaryEl.textContent = summaryLine(state)
	}

	const setPickEnabled = (enabled: boolean) => {
		partyEl.disabled = !enabled
		dateEl.disabled = !enabled
		pickRow.classList.toggle('is-locked', !enabled)
	}

	const showActions = (step: Step) => {
		actionsEl.dataset.actions = step
		nextBtn.hidden = step !== 'slot'
		confirmCancelBtn.hidden = step !== 'confirm'
		confirmOkBtn.hidden = step !== 'confirm'
		backBtn.hidden = step !== 'details'
		submitBtn.hidden = step !== 'details'
		resetBtn.hidden = step !== 'done'
	}

	const showStep = (step: Step) => {
		for (const el of root.querySelectorAll<HTMLElement>('[data-reserve-step]')) {
			const active = el.dataset.reserveStep === step
			el.hidden = !active
			el.classList.toggle('is-active', active)
		}

		const showPick = step === 'slot'
		pickRow.hidden = !showPick
		summaryEl.hidden = !(step === 'details' || step === 'done')
		setPickEnabled(step === 'slot')
		showActions(step)
		root.dataset.reservePhase = step

		if (step === 'slot') requestAnimationFrame(syncTimesScroll)
		if (step === 'confirm') {
			confirmCopyEl.textContent = confirmCopy(state)
			confirmOkBtn.focus()
		}
		if (step === 'details') {
			syncSummary()
			form.querySelector<HTMLInputElement>('input[name="firstName"]')?.focus()
		}
		if (step === 'done') syncSummary()
	}

	const goConfirm = () => {
		showStep('confirm')
	}

	partyEl.addEventListener('change', () => {
		state.party = Number(partyEl.value) || 2
	})

	dateEl.addEventListener('change', () => {
		const next = dateEl.value || state.earliest
		const day = parseISODate(next)
		if (day.getDay() === 1) {
			// Snap closed Mondays forward to Tuesday.
			day.setDate(day.getDate() + 1)
			dateEl.value = toISODate(day)
		}
		if (dateEl.value < state.earliest) dateEl.value = state.earliest
		state.date = dateEl.value
	})

	nextBtn.addEventListener('click', () => {
		if (!state.time) return
		state.party = Number(partyEl.value) || 2
		state.date = dateEl.value || state.earliest
		goConfirm()
	})

	confirmCancelBtn.addEventListener('click', () => {
		showStep('slot')
	})

	confirmOkBtn.addEventListener('click', () => {
		showStep('details')
	})

	backBtn.addEventListener('click', () => {
		showStep('confirm')
	})

	form.addEventListener('submit', (event) => {
		event.preventDefault()
		syncSummary()
		showStep('done')
	})

	resetBtn.addEventListener('click', () => {
		form.reset()
		state.time = null
		state.party = 2
		state.date = state.earliest
		partyEl.value = '2'
		dateEl.value = state.earliest
		for (const btn of timesEl.querySelectorAll('.reserve-time')) {
			btn.classList.remove('is-selected')
			btn.setAttribute('aria-selected', 'false')
		}
		nextBtn.disabled = true
		nextBtn.classList.remove('is-ready')
		showStep('slot')
	})

	for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-reserve-link]')) {
		link.addEventListener('click', (event) => event.preventDefault())
	}

	// Keep card expand from treating form keys as tile activation.
	root.addEventListener('keydown', (event) => event.stopPropagation())
	root.addEventListener('click', (event) => event.stopPropagation())

	showStep('slot')
}
