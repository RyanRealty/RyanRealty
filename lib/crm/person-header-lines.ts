/**
 * A3 person-header NEXT and NOW sentences. Display only. Admin voice: as
 * simple as possible. No typed fields.
 *
 * A3: no person-scoped copilot rec API. Show the best existing next action
 * from unreplied inbound, reply-intent, open triage task, or
 * awaiting_broker_next. Do not invent a recommendation engine.
 */
import type { ReplyIntent } from '@/lib/crm/reply-intent'

export const LIVE_LISTING_VIEW_MS = 30 * 60 * 1000
export const RECENT_LISTING_VIEW_MS = 24 * 60 * 60 * 1000

export type PersonListingView = {
  listingMls: string | null
  listingStreet: string | null
  eventAt: string
}

export type PersonNextFacts = {
  unrepliedInbound: { channel: 'sms' | 'email' } | null
  replyIntent: ReplyIntent | null
  /** Plain task signal already classified (showing / hot-lead call / new-lead call). */
  triageTask: { name: string | null; type: string | null } | null
  sequenceWaiting: { sequenceName: string; channel: string } | null
}

const REPLY_INTENTS: ReadonlySet<string> = new Set([
  'interested',
  'question',
  'not_interested',
  'wrong_number',
  'later',
  'other',
])

export function asReplyIntent(value: unknown): ReplyIntent | null {
  return typeof value === 'string' && REPLY_INTENTS.has(value) ? (value as ReplyIntent) : null
}

export function listingViewIsRecent(view: PersonListingView | null, nowMs: number = Date.now()): boolean {
  if (!view) return false
  const t = Date.parse(view.eventAt)
  return Number.isFinite(t) && nowMs - t <= RECENT_LISTING_VIEW_MS
}

export function composePersonNowLine(input: {
  latestListingView: PersonListingView | null
  nowMs?: number
}): string {
  const now = input.nowMs ?? Date.now()
  const view = input.latestListingView
  if (!view) return 'Not on the site.'
  const viewT = Date.parse(view.eventAt)
  if (!Number.isFinite(viewT) || now - viewT > RECENT_LISTING_VIEW_MS) return 'Not on the site.'
  const street = (view.listingStreet ?? '').trim()
  const home = street || (view.listingMls ? `MLS ${view.listingMls}` : 'a home')
  if (now - viewT <= LIVE_LISTING_VIEW_MS) return `Looking at ${home} now.`
  return `Looked at ${home}.`
}

export function composePersonNextStep(facts: PersonNextFacts): string {
  if (facts.unrepliedInbound) {
    if (facts.replyIntent === 'not_interested') return 'Stop outreach. They are not interested.'
    if (facts.replyIntent === 'wrong_number') return 'Remove this number.'
    if (facts.replyIntent === 'later') return 'Follow up later.'
    if (facts.replyIntent === 'question') return 'Reply. They asked a question.'
    if (facts.replyIntent === 'interested') return 'Reply. They are interested.'
    return facts.unrepliedInbound.channel === 'sms' ? 'Reply to their text.' : 'Reply to their email.'
  }

  if (facts.triageTask) {
    const name = (facts.triageTask.name ?? '').toLowerCase()
    const type = (facts.triageTask.type ?? '').toLowerCase()
    if (/showing|tour/.test(name) || /showing|tour/.test(type)) return 'Handle the showing request.'
    if (/hot .* lead|hot lead|call within 5 min/.test(name)) return 'Call this hot lead.'
    return 'Call this lead.'
  }

  if (facts.sequenceWaiting) {
    const name = facts.sequenceWaiting.sequenceName.trim() || 'sequence'
    const channel = facts.sequenceWaiting.channel
    if (channel === 'sms') return `Send the next ${name} text.`
    if (channel === 'email') return `Send the next ${name} email.`
    return `Send the next ${name} step.`
  }

  return 'No next step queued.'
}

/** List glance: last lead-initiated kind plus any waiting sequence step. */
export function composeListNextStep(input: {
  lastActivityKind: string | null
  sequenceWaiting: PersonNextFacts['sequenceWaiting']
}): string {
  const kind = input.lastActivityKind
  if (kind === 'sms_in') {
    return composePersonNextStep({
      unrepliedInbound: { channel: 'sms' },
      replyIntent: null,
      triageTask: null,
      sequenceWaiting: null,
    })
  }
  if (kind === 'email_in') {
    return composePersonNextStep({
      unrepliedInbound: { channel: 'email' },
      replyIntent: null,
      triageTask: null,
      sequenceWaiting: null,
    })
  }
  if (kind === 'inquiry' || kind === 'property_inquiry' || kind === 'form_submission') {
    return composePersonNextStep({
      unrepliedInbound: null,
      replyIntent: null,
      triageTask: { name: kind, type: kind },
      sequenceWaiting: null,
    })
  }
  return composePersonNextStep({
    unrepliedInbound: null,
    replyIntent: null,
    triageTask: null,
    sequenceWaiting: input.sequenceWaiting,
  })
}

/** Newest-first messages. Unreplied = latest inbound is newer than latest outbound. */
export function unrepliedInboundFromMessages(
  items: ReadonlyArray<{ kind: string; ts: string; payload?: Record<string, unknown> | null }>,
): { channel: 'sms' | 'email'; replyIntent: ReplyIntent | null } | null {
  let lastIn: { channel: 'sms' | 'email'; ts: number; payload: Record<string, unknown> | null } | null = null
  let lastOutTs = -Infinity
  for (const m of items) {
    const t = Date.parse(m.ts)
    if (!Number.isFinite(t)) continue
    if (m.kind === 'sms_in' || m.kind === 'email_in') {
      if (!lastIn || t > lastIn.ts) {
        lastIn = {
          channel: m.kind.startsWith('sms') ? 'sms' : 'email',
          ts: t,
          payload: m.payload ?? null,
        }
      }
    } else if (m.kind === 'sms_out' || m.kind === 'email_out') {
      if (t > lastOutTs) lastOutTs = t
    }
  }
  if (!lastIn || lastOutTs >= lastIn.ts) return null
  return {
    channel: lastIn.channel,
    replyIntent: asReplyIntent(lastIn.payload?.intent),
  }
}

export function replyIntentFromTimeline(
  rows: ReadonlyArray<{ kind: string; payload?: Record<string, unknown> | null }>,
): ReplyIntent | null {
  for (const r of rows) {
    if (r.kind !== 'system') continue
    const intent = asReplyIntent(r.payload?.intent)
    if (intent) return intent
  }
  return null
}
