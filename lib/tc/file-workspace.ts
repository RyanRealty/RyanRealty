/**
 * The file workspace, as data: which cycle a file opens on, the milestone
 * track across its top, what on the file needs a person, and how the checklist
 * filters (Matt 2026-09-24: tabs with the document beside its checklist, in
 * place of the one long page).
 *
 * Pure: no I/O. Dates are calendar days ("YYYY-MM-DD") compared as days, so a
 * closing date never shifts through a time zone.
 */
import { dealCalendarItems } from './deal-calendar'
import { shortDate } from './dashboard'

export const FILE_TABS = ['overview', 'documents', 'offers', 'email', 'people', 'signing', 'money', 'activity'] as const
export type FileTab = (typeof FILE_TABS)[number]

export const FILE_TAB_LABEL: Record<FileTab, string> = {
  overview: 'Overview',
  documents: 'Documents',
  offers: 'Offers',
  email: 'Email',
  people: 'People',
  signing: 'Signing',
  money: 'Money',
  activity: 'Activity',
}

export function fileTab(raw: string | undefined | null): FileTab {
  return (FILE_TABS as readonly string[]).includes(String(raw)) ? (raw as FileTab) : 'overview'
}

export type WorkspaceCycle = {
  id: string
  kind: 'sale' | 'listing'
  status: string | null
  listing_price?: number | null
  sale_price?: number | null
  contract_acceptance_date: string | null
  escrow_closing_date: string | null
  actual_closing_date: string | null
  expiration_date: string | null
  dead_date: string | null
  inspection_days: number | null
  financing_days: number | null
  listing_date?: string | null
}

const cancelled = (c: WorkspaceCycle) => /cancel|dead|terminat|withdrawn|expired/i.test(c.status ?? '') || !!c.dead_date

/** How recent a cycle is, by its own dates (getTcDeal sorts by status, not age). */
function recency(c: WorkspaceCycle): string {
  return String(c.actual_closing_date ?? c.contract_acceptance_date ?? c.escrow_closing_date ?? c.listing_date ?? c.expiration_date ?? c.dead_date ?? '')
}

/**
 * The cycle a file opens on: the one asked for; else the live one that matches
 * the file's stage (a sale under contract, the listing while it is on the
 * market); else the newest that is not cancelled; else the newest.
 */
export function currentCycle<C extends WorkspaceCycle>(cycles: readonly C[], stage: string, requested?: string | null): C | null {
  if (!cycles.length) return null
  if (requested) {
    const hit = cycles.find((c) => c.id === requested)
    if (hit) return hit
  }
  const newestFirst = [...cycles].sort((a, b) => recency(b).localeCompare(recency(a)))
  if (stage === 'pending' || stage === 'pre_contract') {
    const sale = newestFirst.find((c) => c.kind === 'sale' && !cancelled(c))
    if (sale) return sale
  }
  if (stage === 'active_listing') {
    const listing = newestFirst.find((c) => c.kind === 'listing' && !cancelled(c))
    if (listing) return listing
  }
  if (stage === 'closed') {
    const closed = newestFirst.find((c) => c.kind === 'sale' && (!!c.actual_closing_date || /closed/i.test(c.status ?? '')))
    if (closed) return closed
  }
  return newestFirst.find((c) => !cancelled(c)) ?? newestFirst[0]
}

/** "Sale · accepted Jul 21, 2026" / "Listing · listed Aug 1, 2026" — the cycle switcher's words. */
export function cycleLabel(c: WorkspaceCycle): string {
  const year = (iso: string | null | undefined) => (iso ? `, ${String(iso).slice(0, 4)}` : '')
  if (c.kind === 'listing') {
    const d = c.listing_date ?? null
    return `Listing${d ? ` · listed ${shortDate(d)}${year(d)}` : ''}${c.status ? ` · ${c.status}` : ''}`
  }
  const d = c.contract_acceptance_date
  return `Sale${d ? ` · accepted ${shortDate(d)}${year(d)}` : ''}${c.status ? ` · ${c.status}` : ''}`
}

function dayNum(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`)
  return Number.isFinite(t) ? Math.round(t / 86_400_000) : null
}

function relative(n: number): string {
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

export type WorkspaceStep = {
  key: string
  label: string
  date: string
  state: 'done' | 'next' | 'late' | 'past' | 'later'
}

/**
 * The milestone track. A sale: accepted → earnest money → inspection →
 * financing → closing (banking days from acceptance, the same math as the
 * calendar). A listing: listed → expires. Only the acceptance and a recorded
 * close read as done; a deadline that has passed reads "passed", because the
 * Vault cannot see that the contingency was actually met.
 */
export function milestonesFor(cycle: WorkspaceCycle | null, today: string): WorkspaceStep[] {
  if (!cycle) return []
  const t = dayNum(today) ?? 0
  const steps: WorkspaceStep[] = []
  if (cycle.kind === 'listing') {
    if (cycle.listing_date) {
      const n = (dayNum(cycle.listing_date) ?? t) - t
      steps.push({ key: 'listed', label: 'Listed', date: `${shortDate(cycle.listing_date)}${n <= 0 ? ` · ${-n} days on market` : ''}`, state: n <= 0 ? 'done' : 'later' })
    }
    if (cycle.expiration_date) {
      const n = (dayNum(cycle.expiration_date) ?? t) - t
      steps.push({
        key: 'expires',
        label: n < 0 ? 'Expired' : 'Listing expires',
        date: `${shortDate(cycle.expiration_date)} · ${relative(n)}`,
        state: n < 0 ? 'late' : 'next',
      })
    }
    return steps
  }
  const accepted = cycle.contract_acceptance_date
  if (accepted) steps.push({ key: 'accepted', label: 'Accepted', date: shortDate(accepted), state: 'done' })
  const items = dealCalendarItems({
    address: '',
    cycles: [
      {
        id: cycle.id,
        contract_acceptance_date: accepted,
        inspectionDays: cycle.inspection_days,
        financingDays: cycle.financing_days,
      },
    ],
  })
  const pick: Array<[string, string]> = [
    ['earnest_money_due', 'Earnest money'],
    ['inspection_period_ends', 'Inspection ends'],
    ['financing_contingency_ends', 'Financing ends'],
  ]
  for (const [kind, label] of pick) {
    const it = items.find((i) => i.kind === kind)
    if (!it) continue
    const n = (dayNum(it.date) ?? t) - t
    steps.push({ key: kind, label, date: `${shortDate(it.date)} · ${n < 0 ? 'passed' : relative(n)}`, state: n < 0 ? 'past' : 'later' })
  }
  if (cycle.actual_closing_date) {
    steps.push({ key: 'closed', label: 'Closed', date: shortDate(cycle.actual_closing_date), state: 'done' })
  } else if (cycle.dead_date || /cancel|terminat|dead/i.test(cycle.status ?? '')) {
    steps.push({ key: 'dead', label: 'Canceled', date: cycle.dead_date ? shortDate(cycle.dead_date) : '', state: 'late' })
  } else if (cycle.escrow_closing_date) {
    const n = (dayNum(cycle.escrow_closing_date) ?? t) - t
    steps.push({
      key: 'closing',
      label: 'Closing',
      date: `${shortDate(cycle.escrow_closing_date)} · ${n < 0 ? `${-n} days late` : relative(n)}`,
      state: n < 0 ? 'late' : 'later',
    })
  }
  // The first step still ahead is "next".
  const nextIdx = steps.findIndex((s) => s.state === 'later')
  if (nextIdx >= 0) steps[nextIdx] = { ...steps[nextIdx], state: 'next' }
  return steps
}

export type ChecklistStatus = 'required' | 'optional' | 'in_review' | 'completed' | 'na'
export type ChecklistFilter = 'all' | 'review' | 'missing' | 'done'

export function checklistFilter(raw: string | undefined | null): ChecklistFilter {
  return raw === 'review' || raw === 'missing' || raw === 'done' ? raw : 'all'
}

export function matchesChecklistFilter(status: ChecklistStatus, filter: ChecklistFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'review') return status === 'in_review'
  if (filter === 'missing') return status === 'required'
  return status === 'completed' || status === 'na'
}

/** The checklist word a person reads (status + color, never color alone). */
export const CHECKLIST_WORD: Record<ChecklistStatus, { word: string; state: 'down' | 'slow' | 'waiting' | 'ok' | 'accent' }> = {
  required: { word: 'Missing', state: 'waiting' },
  in_review: { word: 'To review', state: 'slow' },
  completed: { word: 'Done', state: 'ok' },
  na: { word: 'Not needed', state: 'ok' },
  optional: { word: 'If needed', state: 'accent' },
}

export type AttentionItem = { key: string; kind: string; tone: 'down' | 'slow' | 'waiting' | 'accent'; title: string; context: string; href: string; action: string }

/** What on this file needs a person, most urgent first. */
export function fileAttention(input: {
  propertyKey: string
  stage: string
  stageDetail: string | null
  cycle: WorkspaceCycle | null
  checklist: ReadonlyArray<{ name: string; status: ChecklistStatus }>
  superuser: boolean
  today: string
}): AttentionItem[] {
  const base = `/admin/deals/${encodeURIComponent(input.propertyKey)}`
  const q = (tab: string, extra?: string) => `${base}?tab=${tab}${input.cycle ? `&cycle=${input.cycle.id}` : ''}${extra ? `&${extra}` : ''}`
  const out: AttentionItem[] = []
  const t = dayNum(input.today) ?? 0
  const review = input.checklist.filter((i) => i.status === 'in_review')
  const missing = input.checklist.filter((i) => i.status === 'required')
  if (/^Opened from email/i.test(input.stageDetail ?? '')) {
    out.push({ key: 'confirm', kind: 'New file', tone: 'slow', title: 'Confirm which side we represent and where the file stands', context: 'Opened from email; set the stage above', href: base, action: 'Set stage' })
  }
  if (input.cycle && input.stage === 'pending' && !input.cycle.actual_closing_date && input.cycle.escrow_closing_date) {
    const n = (dayNum(input.cycle.escrow_closing_date) ?? t) - t
    if (n < 0) out.push({ key: 'pastclose', kind: 'Closing', tone: 'down', title: `Closing date passed ${-n} days ago`, context: `Set to close ${shortDate(input.cycle.escrow_closing_date)}; record the close or the new date`, href: q('money'), action: 'Update' })
  }
  if (review.length && input.superuser) {
    out.push({ key: 'review', kind: 'Review', tone: 'slow', title: `${review.length} document${review.length === 1 ? '' : 's'} waiting for your review`, context: review.slice(0, 3).map((i) => i.name).join(' · ') + (review.length > 3 ? ` · ${review.length - 3} more` : ''), href: q('documents', 'filter=review'), action: 'Review' })
  } else if (review.length) {
    out.push({ key: 'review', kind: 'Review', tone: 'accent', title: `${review.length} document${review.length === 1 ? '' : 's'} with the principal broker`, context: review.slice(0, 3).map((i) => i.name).join(' · '), href: q('documents', 'filter=review'), action: 'Open' })
  }
  if (missing.length && input.stage !== 'dead') {
    out.push({ key: 'missing', kind: 'Missing', tone: 'waiting', title: `${missing.length} required document${missing.length === 1 ? '' : 's'} not on file`, context: missing.slice(0, 3).map((i) => i.name).join(' · ') + (missing.length > 3 ? ` · ${missing.length - 3} more` : ''), href: q('documents', 'filter=missing'), action: 'Open checklist' })
  }
  if (input.cycle && input.stage === 'active_listing' && input.cycle.expiration_date) {
    const n = (dayNum(input.cycle.expiration_date) ?? t) - t
    if (n >= 0 && n <= 14) out.push({ key: 'expires', kind: 'Listing', tone: n <= 3 ? 'slow' : 'waiting', title: `Listing expires ${relative(n)}`, context: `${shortDate(input.cycle.expiration_date)} · extend it or let it expire`, href: base, action: 'Open' })
  }
  return out
}
