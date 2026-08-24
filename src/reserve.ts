type Step = 'slot' | 'details' | 'done'

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

function showStep(root: HTMLElement, step: Step) {
	for (const el of root.querySelectorAll<HTMLElement>('[data-reserve-step]')) {
		const active = el.dataset.reserveStep === step
		el.hidden = !active
		el.classList.toggle('is-active', active)
	}
}

function summaryLine(state: State) {
	if (!state.time) return ''
	const start = parseTimeLabel(state.time)
	const end = formatTime(start + SEATING_MINUTES)
	return `${partyLabel(state.party)}, ${formatLongDate(state.date)}, ${state.time} – ${end}`
}

export function enableReservations() {
	const root = document.querySelector<HTMLElement>('[data-reserve-root]')
	if (!root) return

	const partyEl = root.querySelector<HTMLSelectElement>('[data-reserve-party]')
	const dateEl = root.querySelector<HTMLInputElement>('[data-reserve-date]')
	const timesEl = root.querySelector<HTMLElement>('[data-reserve-times]')
	const nextBtn = root.querySelector<HTMLButtonElement>('[data-reserve-next]')
	const backBtn = root.querySelector<HTMLButtonElement>('[data-reserve-back]')
	const resetBtn = root.querySelector<HTMLButtonElement>('[data-reserve-reset]')
	const form = root.querySelector<HTMLFormElement>('[data-reserve-form]')
	const summaryEl = root.querySelector<HTMLElement>('[data-reserve-summary]')
	const doneSummaryEl = root.querySelector<HTMLElement>('[data-reserve-done-summary]')
	const dialog = root.querySelector<HTMLElement>('[data-reserve-dialog]')
	const dialogCopy = root.querySelector<HTMLElement>('[data-reserve-dialog-copy]')
	const dialogOk = root.querySelector<HTMLButtonElement>('[data-reserve-dialog-ok]')
	const dialogCancel = root.querySelector<HTMLButtonElement>(
		'[data-reserve-dialog-cancel]',
	)

	if (
		!partyEl ||
		!dateEl ||
		!timesEl ||
		!nextBtn ||
		!backBtn ||
		!resetBtn ||
		!form ||
		!summaryEl ||
		!doneSummaryEl ||
		!dialog ||
		!dialogCopy ||
		!dialogOk ||
		!dialogCancel
	) {
		return
	}

	const state: State = {
		party: Number(partyEl.value) || 2,
		date: earliestOpenDate(),
		time: null,
		earliest: earliestOpenDate(),
	}

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
			})
			return btn
		}),
	)

	const syncSummary = () => {
		const line = summaryLine(state)
		summaryEl.textContent = line
		doneSummaryEl.textContent = line
	}

	const goDetails = () => {
		syncSummary()
		showStep(root, 'details')
	}

	const openDialog = () => {
		dialogCopy.textContent = `Your reservation will be scheduled for ${formatLongDate(state.date)}. It’s the earliest available date.`
		dialog.hidden = false
		dialogOk.focus()
	}

	const closeDialog = () => {
		dialog.hidden = true
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
		if (state.date === state.earliest) {
			openDialog()
			return
		}
		goDetails()
	})

	dialogCancel.addEventListener('click', () => closeDialog())
	dialogOk.addEventListener('click', () => {
		closeDialog()
		goDetails()
	})

	backBtn.addEventListener('click', () => {
		showStep(root, 'slot')
	})

	form.addEventListener('submit', (event) => {
		event.preventDefault()
		if (!form.reportValidity()) return
		syncSummary()
		showStep(root, 'done')
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
		showStep(root, 'slot')
	})

	for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-reserve-link]')) {
		link.addEventListener('click', (event) => event.preventDefault())
	}

	// Keep card expand from treating form keys as tile activation.
	root.addEventListener('keydown', (event) => event.stopPropagation())
	root.addEventListener('click', (event) => event.stopPropagation())
}
