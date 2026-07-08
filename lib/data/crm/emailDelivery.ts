import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  recoverSendTypes,
  safeRate,
  type RawEmailEventRow,
} from '@/lib/data/crm/getEmailReporting'
import { buildDeliveryAttention, type DeliveryAttentionItem } from '@/lib/data/crm/emailDeliveryAttention'

/**
 * emailDelivery — the delivery-observability read side (WS4).
 *
 * Answers the broker's questions in plain terms: who is getting what email,
 * when it last went out, whether anyone opened or clicked it, and what failed.
 * Two readers:
 *
 *   - getGlobalDeliverySummary({days}): per-stream rollup (listing alerts,
 *     market reports, newsletters when events exist) + an "attention" list of
 *     things that look wrong, each with a plain-English fix — powers the
 *     Delivery tab on /admin/crm/subscriptions.
 *   - getPersonDeliveryHistory({personId?, email?}): one row per email actually
 *     sent to that person across every stream, with opened/clicked/bounced
 *     flags — powers the per-person ContactDeliveryPanel.
 *   - getPersonSubscriptionOutlook(personId, email?): the person's active
 *     subscriptions with their next-expected-send, so the panel can say
 *     "monthly market report — next one due in 12 days".
 *
 * Substrate: email_events (lib/crm/email-events.ts is the single writer).
 * Send paths write `sent` with the true send_type; the Resend webhook writes
 * delivered/open/click/bounce/complaint with send_type 'other' (recovered here
 * via the message_id join, same as getEmailReporting.recoverSendTypes).
 *
 * Failure honesty (§0): bounces and spam complaints ARE tracked (Resend
 * webhook → email_events). A synchronous send-API failure is NOT persisted
 * per-recipient anywhere today — the crons keep it only in an ephemeral run
 * summary. The one durable trace is crm_report_subscriptions.last_attempt_at
 * advancing while last_sent_at does not, which the attention list surfaces as
 * "we tried but it did not go out". The UI copy says exactly that, no more.
 *
 * DAL boundary (G1): every raw .from() read lives here (or in the sibling
 * emailDeliveryAttention.ts), inside lib/data/.
 */

// ── Streams ──────────────────────────────────────────────────────────────────

export type DeliveryStream = 'listing-alerts' | 'market-reports' | 'newsletters' | 'other'

export const STREAM_LABELS: Record<DeliveryStream, string> = {
  'listing-alerts': 'Listing alerts',
  'market-reports': 'Market reports',
  newsletters: 'Newsletters',
  other: 'Other emails',
}

/** Map a (recovered) email_events.send_type to a broker-facing stream. PURE. */
export function streamForSendType(sendType: string | null | undefined): DeliveryStream {
  const st = (sendType ?? '').trim().toLowerCase()
  if (st === 'alert') return 'listing-alerts'
  if (st === 'market-report') return 'market-reports'
  if (st === 'newsletter') return 'newsletters'
  return 'other'
}

/**
 * Stream from the per-send instrumentation key's prefix — the fallback when a
 * row's send_type is 'other' (historical tracker rows before the 2026-07-06
 * sendTypeFromEmailKey fix stored 'other' even for alert opens). PURE.
 */
export function streamForEmailKey(emailKey: string | null | undefined): DeliveryStream {
  const prefix = (emailKey ?? '').trim().toLowerCase().split(':')[0]
  if (prefix === 'alert' || prefix === 'listing-alert') return 'listing-alerts'
  if (prefix === 'market-report' || prefix === 'market' || prefix === 'report') return 'market-reports'
  if (prefix === 'newsletter') return 'newsletters'
  return 'other'
}

/** Best stream for one raw row: concrete send_type first, else email_key prefix. */
function streamForRow(r: RawEmailEventRow): DeliveryStream {
  const byType = streamForSendType(r.send_type)
  return byType !== 'other' ? byType : streamForEmailKey(r.email_key)
}

// ── Per-send fold ────────────────────────────────────────────────────────────

/** The headline status of one send, in lifecycle order (worst/latest wins). */
export type DeliverySendStatus =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'unsubscribed'
  | 'spam complaint'
  | 'bounced'

const STATUS_RANK: Record<DeliverySendStatus, number> = {
  sent: 0,
  delivered: 1,
  opened: 2,
  clicked: 3,
  unsubscribed: 4,
  'spam complaint': 5,
  bounced: 6,
}

const EVENT_TO_STATUS: Record<string, DeliverySendStatus> = {
  sent: 'sent',
  delivered: 'delivered',
  open: 'opened',
  click: 'clicked',
  unsubscribe: 'unsubscribed',
  complaint: 'spam complaint',
  bounce: 'bounced',
}

/** One email send collapsed from its event fan. */
export type DeliverySendRow = {
  /** Stable per-send key (message_id / email_key / recipient+subject). Internal — not for display. */
  key: string
  stream: DeliveryStream
  streamLabel: string
  /** What the email was — the subject line when recorded, else the stream label. */
  label: string
  subject: string | null
  recipientEmail: string | null
  personId: number | null
  /** When it went out (the `sent` event; falls back to the earliest event seen). */
  sentAtIso: string | null
  opened: boolean
  openedAtIso: string | null
  clicked: boolean
  clickedAtIso: string | null
  bounced: boolean
  complained: boolean
  status: DeliverySendStatus
  statusAtIso: string | null
}

type SendAccumulator = DeliverySendRow & { hasSentEvent: boolean; earliestIso: string }

/**
 * Per-send grouping key that stitches ALL of one send's events together.
 *
 * One send's events arrive keyed differently: the `sent` row carries BOTH the
 * provider message_id and the per-send instrumentation email_key; a pixel
 * open/click carries ONLY the email_key; a Resend webhook delivered/bounce
 * carries ONLY the message_id. Keying on either one alone splits the send into
 * two rows (the bug the first live verify caught). So: pass 1 maps
 * message_id -> email_key from rows carrying both; pass 2 keys every row on the
 * resolved email_key first, message_id second, recipient+subject last. PURE.
 */
export function buildMidToEmailKeyMap(rows: RawEmailEventRow[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const r of rows) {
    const mid = (r.message_id ?? '').trim()
    const ek = (r.email_key ?? '').trim()
    if (mid && ek && !map.has(mid)) map.set(mid, ek)
  }
  return map
}

function deliverySendKey(r: RawEmailEventRow, midToEk: Map<string, string>): string {
  const mid = (r.message_id ?? '').trim()
  const ek = (r.email_key ?? '').trim() || (mid ? midToEk.get(mid) ?? '' : '')
  if (ek) return `ek:${ek}`
  if (mid) return `mid:${mid}`
  const recip = (r.recipient_email ?? '').trim().toLowerCase()
  const subj = (r.subject ?? '').trim().toLowerCase()
  return `rs:${recip}|${subj}`
}

/**
 * Collapse a fan of raw events (already send-type-recovered) into one row per
 * send with opened/clicked/bounced flags. PURE — exported for tests.
 */
export function foldSendRows(rows: RawEmailEventRow[]): DeliverySendRow[] {
  const midToEk = buildMidToEmailKeyMap(rows)
  const byKey = new Map<string, SendAccumulator>()
  for (const r of rows) {
    const status = EVENT_TO_STATUS[r.event]
    if (!status) continue
    const key = deliverySendKey(r, midToEk)
    const at = r.occurred_at
    let acc = byKey.get(key)
    if (!acc) {
      const stream = streamForRow(r)
      acc = {
        key,
        stream,
        streamLabel: STREAM_LABELS[stream],
        label: (r.subject ?? '').trim() || STREAM_LABELS[stream],
        subject: r.subject,
        recipientEmail: r.recipient_email || null,
        personId: r.person_id,
        sentAtIso: null,
        opened: false,
        openedAtIso: null,
        clicked: false,
        clickedAtIso: null,
        bounced: false,
        complained: false,
        status,
        statusAtIso: at,
        hasSentEvent: false,
        earliestIso: at,
      }
      byKey.set(key, acc)
    }
    if (at < acc.earliestIso) acc.earliestIso = at
    // Fill metadata a later/earlier row may carry that the first row lacked.
    if (!acc.subject && r.subject) {
      acc.subject = r.subject
      acc.label = r.subject.trim() || acc.label
    }
    if (acc.personId == null && r.person_id != null) acc.personId = r.person_id
    if (!acc.recipientEmail && r.recipient_email) acc.recipientEmail = r.recipient_email
    if (acc.stream === 'other') {
      const stream = streamForRow(r)
      if (stream !== 'other') {
        acc.stream = stream
        acc.streamLabel = STREAM_LABELS[stream]
        if (!acc.subject) acc.label = STREAM_LABELS[stream]
      }
    }
    switch (status) {
      case 'sent':
        acc.hasSentEvent = true
        if (!acc.sentAtIso || at < acc.sentAtIso) acc.sentAtIso = at
        break
      case 'opened':
        acc.opened = true
        if (!acc.openedAtIso || at < acc.openedAtIso) acc.openedAtIso = at
        break
      case 'clicked':
        // A click implies an open even when the open pixel never fired.
        acc.clicked = true
        acc.opened = true
        if (!acc.clickedAtIso || at < acc.clickedAtIso) acc.clickedAtIso = at
        if (!acc.openedAtIso) acc.openedAtIso = at
        break
      case 'bounced':
        acc.bounced = true
        break
      case 'spam complaint':
        acc.complained = true
        break
      case 'delivered':
      case 'unsubscribed':
        break
    }
    const better =
      STATUS_RANK[status] > STATUS_RANK[acc.status] ||
      (STATUS_RANK[status] === STATUS_RANK[acc.status] && at >= (acc.statusAtIso ?? ''))
    if (better) {
      acc.status = status
      acc.statusAtIso = at
    }
  }
  const out: DeliverySendRow[] = []
  for (const acc of byKey.values()) {
    const { hasSentEvent, earliestIso, ...row } = acc
    out.push({ ...row, sentAtIso: hasSentEvent ? acc.sentAtIso : earliestIso })
  }
  // Newest send first.
  return out.sort((a, b) => ((a.sentAtIso ?? '') < (b.sentAtIso ?? '') ? 1 : -1))
}

// ── Global summary ───────────────────────────────────────────────────────────

export type DeliveryStreamSummary = {
  stream: DeliveryStream
  label: string
  /** Distinct sends in the window. */
  sends: number
  /** Distinct sends with at least one open (a click counts as an open). */
  opens: number
  /** opens / sends. NULL when no sends (never a fake 0%). */
  openRate: number | null
  /** Distinct sends with at least one click. */
  clicks: number
  /** Distinct sends that bounced or drew a spam complaint. */
  failures: number
  lastSendAtIso: string | null
}

export type GlobalDeliverySummary = {
  windowDays: number
  generatedAtIso: string
  streams: DeliveryStreamSummary[]
  attention: DeliveryAttentionItem[]
  recentSends: DeliverySendRow[]
  /** Active-subscription counts, for honest empty states ("12 active, none sent yet"). */
  subscriptionCounts: { reportsActive: number; alertsActive: number }
  unreadable: boolean
}

/** Cap on raw events scanned per query (parity with getEmailReporting). */
const SCAN_CAP = 5000
const RECENT_SENDS_LIMIT = 30

/** Tally folded sends into per-stream summaries. PURE — exported for tests. */
export function summarizeStreams(sends: DeliverySendRow[]): DeliveryStreamSummary[] {
  const byStream = new Map<DeliveryStream, DeliveryStreamSummary>()
  const ensure = (stream: DeliveryStream): DeliveryStreamSummary => {
    let s = byStream.get(stream)
    if (!s) {
      s = { stream, label: STREAM_LABELS[stream], sends: 0, opens: 0, openRate: null, clicks: 0, failures: 0, lastSendAtIso: null }
      byStream.set(stream, s)
    }
    return s
  }
  // The two instrumented subscription streams always render (zeros teach).
  ensure('listing-alerts')
  ensure('market-reports')
  for (const row of sends) {
    const s = ensure(row.stream)
    s.sends += 1
    if (row.opened) s.opens += 1
    if (row.clicked) s.clicks += 1
    if (row.bounced || row.complained) s.failures += 1
    if (row.sentAtIso && (!s.lastSendAtIso || row.sentAtIso > s.lastSendAtIso)) {
      s.lastSendAtIso = row.sentAtIso
    }
  }
  for (const s of byStream.values()) s.openRate = safeRate(s.opens, s.sends)
  const order: DeliveryStream[] = ['listing-alerts', 'market-reports', 'newsletters', 'other']
  return order
    .filter((k) => {
      const s = byStream.get(k)
      if (!s) return false
      // Newsletters / other only render when events exist for them.
      if ((k === 'newsletters' || k === 'other') && s.sends === 0) return false
      return true
    })
    .map((k) => byStream.get(k) as DeliveryStreamSummary)
}

/**
 * The Delivery tab's data in one call: per-stream sends/opens/clicks/failures,
 * the attention list (with plain-English fixes), and the recent-sends table.
 */
export async function getGlobalDeliverySummary(
  params: { days?: number } = {},
): Promise<GlobalDeliverySummary> {
  const windowDays = clampDays(params.days)
  const now = Date.now()
  const cutoffIso = new Date(now - windowDays * 86_400_000).toISOString()

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('email_events')
    .select('message_id,recipient_email,person_id,broker,send_type,event,email_key,subject,occurred_at')
    .gte('occurred_at', cutoffIso)
    .order('occurred_at', { ascending: false })
    .limit(SCAN_CAP)

  if (error) {
    console.error('[getGlobalDeliverySummary]', error.message)
    return {
      windowDays,
      generatedAtIso: new Date(now).toISOString(),
      streams: summarizeStreams([]),
      attention: [],
      recentSends: [],
      subscriptionCounts: { reportsActive: 0, alertsActive: 0 },
      unreadable: true,
    }
  }

  const recovered = recoverSendTypes((data ?? []) as RawEmailEventRow[])
  const sendRows = foldSendRows(recovered)

  const { attention, subscriptionCounts } = await buildDeliveryAttention({ sendRows, nowMs: now })

  return {
    windowDays,
    generatedAtIso: new Date(now).toISOString(),
    streams: summarizeStreams(sendRows),
    attention,
    recentSends: sendRows.slice(0, RECENT_SENDS_LIMIT),
    subscriptionCounts,
    unreadable: false,
  }
}

/** Clamp the window to a sane band (1–365, default 30). PURE. */
export function clampDays(days: number | undefined): number {
  if (!Number.isFinite(days) || (days ?? 0) <= 0) return 30
  return Math.min(365, Math.floor(days as number))
}

// ── Per-person history ───────────────────────────────────────────────────────

export type PersonDeliveryHistory = {
  rows: DeliverySendRow[]
  /** Distinct sends found (rows is capped at `limit`). */
  totalSends: number
  unreadable: boolean
}

/**
 * Every email this person actually received (or was sent), newest first,
 * across all streams. Matches on person_id when supplied AND/OR the exact
 * recipient email, so guest sends recorded before the contact was linked
 * still show.
 */
export async function getPersonDeliveryHistory(params: {
  personId?: number | null
  email?: string | null
  limit?: number
}): Promise<PersonDeliveryHistory> {
  const personId =
    typeof params.personId === 'number' && Number.isFinite(params.personId) && params.personId > 0
      ? Math.trunc(params.personId)
      : null
  const email = (params.email ?? '').trim().toLowerCase()
  const limit = Math.min(200, Math.max(1, Math.trunc(params.limit ?? 50)))
  if (!personId && !email) return { rows: [], totalSends: 0, unreadable: false }

  const sb = createServiceClient()
  let query = sb
    .from('email_events')
    .select('message_id,recipient_email,person_id,broker,send_type,event,email_key,subject,occurred_at')
  if (personId && email) {
    // PostgREST or(): email is normalized lowercase at write time; strip chars
    // that would break the filter string rather than pass them through.
    const safe = email.replace(/[,()"\\]/g, '')
    query = query.or(`person_id.eq.${personId},recipient_email.eq.${safe}`)
  } else if (personId) {
    query = query.eq('person_id', personId)
  } else {
    query = query.eq('recipient_email', email)
  }
  const { data, error } = await query.order('occurred_at', { ascending: false }).limit(2000)

  if (error) {
    console.error('[getPersonDeliveryHistory]', error.message)
    return { rows: [], totalSends: 0, unreadable: true }
  }

  const recovered = recoverSendTypes((data ?? []) as RawEmailEventRow[])
  const rows = foldSendRows(recovered)
  return { rows: rows.slice(0, limit), totalSends: rows.length, unreadable: false }
}

// ── Per-person subscription outlook — see emailDeliveryOutlook.ts ───────────
// getPersonSubscriptionOutlook + cadence helpers live in the sibling module
// (lib/data/crm/emailDeliveryOutlook.ts) to stay inside the 600-LOC budget.
