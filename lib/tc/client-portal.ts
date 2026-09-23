/**
 * What a client sees about their own transaction on ryan-realty.com/account.
 * Pure. No I/O.
 *
 * The line between the broker's file and the client's view lives here and only
 * here: stage, key dates, what is waiting on them, documents they signed or we
 * shared, and their team. Never the broker's call notes, texts, internal
 * email, other offers, commission, or the principal's review.
 */
import type { DealCalendarItem } from './deal-calendar'

export type ClientRole = 'buyer' | 'seller'

export type Milestone = {
  key: string
  label: string
  state: 'done' | 'current' | 'upcoming'
  date: string | null
}

type CycleDates = {
  listingDate: string | null
  acceptanceDate: string | null
  closeDate: string | null
  actualCloseDate: string | null
}

function passed(date: string | null, today: string): boolean {
  return !!date && date.slice(0, 10) <= today
}

/**
 * The steps of the deal from the client's side, with the one they are on.
 * Dates come from the file (acceptance, the contingency clocks, closing).
 */
export function clientMilestones(input: {
  role: ClientRole
  stage: string
  dates: CycleDates
  calendar: readonly DealCalendarItem[]
  today: string
}): Milestone[] {
  const { role, stage, dates, calendar, today } = input
  const at = (kind: string) => calendar.find((c) => c.kind === kind)?.date ?? null
  const inspection = at('inspection_period_ends')
  const financing = at('financing_contingency_ends')
  const closing = dates.actualCloseDate ?? dates.closeDate ?? at('escrow_closes')
  const accepted = !!dates.acceptanceDate && (stage === 'pending' || stage === 'closed')
  const closed = stage === 'closed'

  const steps: Array<Omit<Milestone, 'state'> & { done: boolean }> = []
  if (role === 'seller') {
    steps.push({ key: 'listed', label: 'Listed', date: dates.listingDate, done: stage !== 'pre_contract' })
  } else {
    steps.push({ key: 'searching', label: 'Offer written', date: null, done: accepted || closed })
  }
  steps.push({ key: 'accepted', label: 'Offer accepted', date: dates.acceptanceDate, done: accepted || closed })
  if (inspection || accepted) {
    steps.push({ key: 'inspection', label: 'Inspections', date: inspection, done: closed || (accepted && passed(inspection, today)) })
  }
  if (financing) {
    steps.push({ key: 'financing', label: 'Loan and appraisal', date: financing, done: closed || passed(financing, today) })
  }
  steps.push({ key: 'closing', label: 'Closing', date: closing, done: closed })

  // A closed file shows when it closed; contingency clocks computed past that
  // date never ran, so they carry no date.
  const closedOn = closed ? closing : null
  if (closedOn) for (const s of steps) if (s.key !== 'closing' && s.date && s.date > closedOn) s.date = null

  let currentMarked = false
  return steps.map((s) => {
    if (s.done) return { key: s.key, label: s.label, date: s.date, state: 'done' as const }
    if (!currentMarked && stage !== 'dead') {
      currentMarked = true
      return { key: s.key, label: s.label, date: s.date, state: 'current' as const }
    }
    return { key: s.key, label: s.label, date: s.date, state: 'upcoming' as const }
  })
}

export type ClientNextStep = {
  key: string
  title: string
  detail: string
  due: string | null
  kind: 'signature' | 'deadline' | 'task'
}

/** Dates that ask something of this client, in their words. Past dates drop off. */
const CLIENT_DEADLINES: Record<string, { roles: ClientRole[]; title: (r: ClientRole) => string; detail: (r: ClientRole) => string }> = {
  earnest_money_due: {
    roles: ['buyer'],
    title: () => 'Deposit your earnest money',
    detail: () => 'Wire or deliver it to escrow. Call the escrow office at a number you already trust before you send money; never use wiring instructions from an email alone.',
  },
  spds_revocation_ends: {
    roles: ['buyer'],
    title: () => "Review the seller's property disclosure",
    detail: () => 'Your window to review the disclosure statement closes on this date.',
  },
  inspection_period_ends: {
    roles: ['buyer', 'seller'],
    title: (r) => (r === 'buyer' ? 'Finish inspections' : 'Inspection period ends'),
    detail: (r) =>
      r === 'buyer'
        ? 'Inspections and any repair request need to be done by this date.'
        : "The buyer's inspection period ends. Any repair request arrives before then.",
  },
  financing_contingency_ends: {
    roles: ['buyer', 'seller'],
    title: (r) => (r === 'buyer' ? 'Loan approval and appraisal' : "Buyer's financing deadline"),
    detail: (r) =>
      r === 'buyer'
        ? 'Keep your lender moving: send what they ask for the same day.'
        : "The buyer's loan and appraisal contingency ends on this date.",
  },
  escrow_closes: {
    roles: ['buyer', 'seller'],
    title: () => 'Closing',
    detail: (r) =>
      r === 'buyer'
        ? 'Escrow will schedule your signing. Bring a photo ID.'
        : 'Escrow will schedule your signing. Bring a photo ID and plan to hand over keys at recording.',
  },
}

export function clientNextSteps(input: {
  role: ClientRole
  stage: string
  calendar: readonly DealCalendarItem[]
  pendingSignatures: ReadonlyArray<{ recipientId: string; envelopeName: string; sentAt: string | null }>
  tasks: ReadonlyArray<{ id: string; title: string; detail: string | null; dueDate: string | null }>
  today: string
}): ClientNextStep[] {
  const out: ClientNextStep[] = []
  for (const s of input.pendingSignatures) {
    out.push({
      key: `sign:${s.recipientId}`,
      title: `Sign: ${s.envelopeName}`,
      detail: 'Waiting on your signature.',
      due: null,
      kind: 'signature',
    })
  }
  for (const t of input.tasks) {
    out.push({ key: `task:${t.id}`, title: t.title, detail: t.detail ?? '', due: t.dueDate, kind: 'task' })
  }
  if (input.stage === 'pending') {
    for (const c of input.calendar) {
      const rule = CLIENT_DEADLINES[c.kind]
      if (!rule || !rule.roles.includes(input.role)) continue
      if (c.date < input.today) continue
      out.push({ key: `date:${c.kind}`, title: rule.title(input.role), detail: rule.detail(input.role), due: c.date, kind: 'deadline' })
    }
  }
  return out.sort((a, b) => {
    if (a.kind === 'signature' && b.kind !== 'signature') return -1
    if (b.kind === 'signature' && a.kind !== 'signature') return 1
    return (a.due ?? '9999').localeCompare(b.due ?? '9999')
  })
}

/** "2840 NE Sedalia Loop, Bend, OR 97701 — Sellers Repair Addendum" → "Sellers Repair Addendum" (the page already names the property). */
export function envelopeNameForClient(name: string, address: string): string {
  const street = address.split(',')[0]?.trim() ?? ''
  let out = name
  for (const prefix of [address.trim(), street]) {
    if (prefix && out.toLowerCase().startsWith(prefix.toLowerCase())) {
      out = out.slice(prefix.length).replace(/^[\s,]*[—–-]\s*/, '')
      break
    }
  }
  return out.trim() || name
}

/**
 * The client's activity feed from the file's audit trail: only their own
 * envelopes (a buyer never sees the seller's listing agreement go out), one
 * line per envelope (signed by everyone replaces sent), newest first.
 */
export function clientActivity(input: {
  events: ReadonlyArray<{ action: string; detail: Record<string, unknown> | null; at: string }>
  role: ClientRole
  address: string
  myEnvelopeNames: ReadonlySet<string>
  limit?: number
}): Array<{ at: string; label: string }> {
  const completed = new Set(
    input.events
      .filter((e) => e.action === 'envelope_completed' || e.action === 'envelope_completed_from_return')
      .map((e) => String(e.detail?.envelope ?? '')),
  )
  const out: Array<{ at: string; label: string }> = []
  for (const e of input.events) {
    const envelope = typeof e.detail?.envelope === 'string' ? e.detail.envelope : null
    if (envelope !== null && e.action.startsWith('envelope_')) {
      if (!input.myEnvelopeNames.has(envelope)) continue
      if (e.action === 'envelope_sent' && completed.has(envelope)) continue
    }
    const detail = envelope ? { ...e.detail, envelope: envelopeNameForClient(envelope, input.address) } : e.detail
    const label = clientActivityLabel(e.action, detail, input.role)
    // The same milestone logged twice reads once.
    if (label && !out.some((o) => o.label === label)) out.push({ at: e.at, label })
  }
  return out.slice(0, input.limit ?? 12)
}

/**
 * Activity a client may see, in their words. Everything else on the audit
 * trail (mail and text filing, principal review, commission, offers from other
 * buyers, notes) returns null and never leaves the server.
 */
export function clientActivityLabel(action: string, detail: Record<string, unknown> | null, role: ClientRole): string | null {
  const envelope = typeof detail?.envelope === 'string' ? detail.envelope : null
  switch (action) {
    case 'listing_contract_accepted':
    case 'offer_accepted':
      return role === 'seller' ? 'You accepted an offer' : 'Your offer was accepted'
    case 'deal_stage_changed': {
      const to = typeof detail?.to === 'string' ? detail.to : typeof detail?.stage === 'string' ? detail.stage : null
      if (to === 'closed') return 'Closed'
      if (to === 'pending') return 'Under contract'
      if (to === 'active_listing') return 'Listed'
      return null
    }
    case 'envelope_sent':
      return envelope ? `Sent for signature: ${envelope}` : 'Documents sent for signature'
    case 'envelope_completed':
    case 'envelope_completed_from_return':
      return envelope ? `Signed by everyone: ${envelope}` : 'Documents signed by everyone'
    case 'document_shared_with_client':
      return typeof detail?.name === 'string' ? `Shared with you: ${detail.name}` : 'A document was shared with you'
    default:
      return null
  }
}

export const CLIENT_STAGE_LABEL: Record<string, string> = {
  pre_contract: 'Getting started',
  active_listing: 'Listed',
  pending: 'Under contract',
  closed: 'Closed',
  dead: 'Closed without a sale',
}

/** Roles on the file a client may see and contact. */
export const CLIENT_TEAM_ROLES = new Set(['escrow', 'title', 'lender', 'loan_officer', 'transaction_coordinator', 'home_warranty'])

export const CLIENT_TEAM_ROLE_LABEL: Record<string, string> = {
  escrow: 'Escrow officer',
  title: 'Title officer',
  lender: 'Lender',
  loan_officer: 'Loan officer',
  transaction_coordinator: 'Transaction coordinator',
  home_warranty: 'Home warranty',
}
