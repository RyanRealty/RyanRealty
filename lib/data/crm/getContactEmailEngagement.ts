/**
 * getContactEmailEngagement — the per-contact email-engagement summary the CRM
 * record card renders (Wave 5, the unified email_events store).
 *
 * Reads ONLY from email_events (the single source both the Resend webhook rail
 * and the Gmail open/click tracker rail now write to). Every number returned
 * traces to a real email_events row for this person — no placeholder, no
 * zero-under-false-copy (CLAUDE.md §0).
 *
 * DAL boundary (G1): the raw .from('email_events') read lives here, inside
 * lib/data/. The UI/component calls this; it never queries the table directly.
 *
 * OVERLAP NOTE FOR THE INTEGRATOR: the sibling email-reporting piece is expected
 * to export a getContactEmailEngagement of its own. If that lands, dedupe to one
 * implementation (keep the richer one, point the record card at it). This file
 * is the minimal record-card reader so the card is not blocked on that piece.
 */
import { createServiceClient } from '@/lib/supabase/service'
import type { EmailEvent } from '@/lib/crm/email-events'
import {
  collapseSendLog,
  inheritEmailKeys,
  type RawEmailEventRow,
} from './getEmailReporting'
import { readLastSiteByPerson } from './getVisitorLastSeen'

const EVENT_SELECT =
  'message_id,recipient_email,person_id,broker,send_type,event,email_key,subject,occurred_at'
const PAGE = 1000
const IN_CHUNK = 200

export type ContactEmailSend = {
  key: string
  emailKey: string | null
  messageId: string | null
  subject: string | null
  sentAt: string | null
  deliveredAt: string | null
  openedAt: string | null
  clickedAt: string | null
  bouncedAt: string | null
  latestEvent: EmailEvent
  campaignJobId: number | null
  lastSiteAt: string | null
  visitedAfterSend: boolean
}

export function campaignJobIdFromEmailKey(emailKey: string | null | undefined): number | null {
  const m = /^bulk:email-cohort:(\d+)$/.exec((emailKey ?? '').trim())
  if (!m) return null
  const id = Number(m[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

export function emailSendStatusLabel(s: ContactEmailSend): string {
  if (s.bouncedAt) return 'Bounced'
  if (s.clickedAt) return 'Clicked'
  if (s.openedAt) return 'Opened'
  if (s.deliveredAt) return 'Delivered'
  if (s.sentAt) return 'Sent'
  return s.latestEvent
}

export function emailSendCampaignHref(s: ContactEmailSend): string | null {
  return s.campaignJobId != null ? `/admin/crm/reporting/batch-emails/${s.campaignJobId}` : null
}

/** Match a timeline/thread email to a folded send. PURE. */
export function matchEmailSend(
  sends: ContactEmailSend[],
  hint: { messageId?: string | null; subject?: string | null },
): ContactEmailSend | null {
  const mid = (hint.messageId ?? '').trim()
  if (mid) {
    const hit = sends.find((s) => (s.messageId ?? '').trim() === mid)
    if (hit) return hit
  }
  const subj = (hint.subject ?? '').trim().toLowerCase()
  if (!subj) return null
  const hits = sends.filter((s) => (s.subject ?? '').trim().toLowerCase() === subj)
  return hits.length === 1 ? hits[0] : null
}

export type EmailTimelineOverlay = {
  id: number
  kind: string
  ts: string
  title: string | null
  body: string | null
  broker: string | null
  source: string
  starred: boolean
  payload: Record<string, unknown>
  opens?: number
  clicks?: number
  delivered?: boolean
  bounced?: boolean
  visitedAfterSend?: boolean
  campaignHref?: string | null
}

function syntheticId(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0
  return h < 0 ? h : -h - 1
}

function annotateWithSend<T extends EmailTimelineOverlay>(item: T, send: ContactEmailSend): T {
  return {
    ...item,
    opens: send.openedAt ? Math.max(item.opens ?? 0, 1) : item.opens,
    clicks: send.clickedAt ? Math.max(item.clicks ?? 0, 1) : item.clicks,
    delivered: Boolean(send.deliveredAt),
    bounced: Boolean(send.bouncedAt),
    visitedAfterSend: send.visitedAfterSend,
    campaignHref: emailSendCampaignHref(send),
  }
}

function sendAsTimelineItem(send: ContactEmailSend): EmailTimelineOverlay {
  return {
    id: syntheticId(send.key),
    kind: 'email_out',
    ts: send.sentAt ?? send.deliveredAt ?? send.openedAt ?? send.clickedAt ?? send.bouncedAt ?? new Date(0).toISOString(),
    title: send.subject,
    body: null,
    broker: null,
    source: send.campaignJobId != null ? 'campaign' : 'app',
    starred: false,
    payload: { emailKey: send.emailKey, messageId: send.messageId },
    opens: send.openedAt ? 1 : undefined,
    clicks: send.clickedAt ? 1 : undefined,
    delivered: Boolean(send.deliveredAt),
    bounced: Boolean(send.bouncedAt),
    visitedAfterSend: send.visitedAfterSend,
    campaignHref: emailSendCampaignHref(send),
  }
}

/**
 * Overlay email_events onto timeline email_out rows, and insert bulk sends that
 * never wrote a timeline row so they still show on the lead.
 */
export function mergeEmailSendsIntoTimeline<T extends EmailTimelineOverlay>(
  items: T[],
  sends: ContactEmailSend[],
): T[] {
  if (sends.length === 0) return items
  const used = new Set<string>()
  const matched = items.map((item) => {
    if (item.kind !== 'email_out') return item
    const send = matchEmailSend(sends, {
      messageId: payloadMessageId(item.payload),
      subject: item.title,
    })
    if (!send) return item
    used.add(send.key)
    return annotateWithSend(item, send)
  })
  const extras = sends.filter((s) => !used.has(s.key)).map(sendAsTimelineItem) as T[]
  if (extras.length === 0) return matched
  return [...matched, ...extras].sort((a, b) => (a.ts < b.ts ? 1 : -1))
}

export function payloadMessageId(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null
  for (const k of ['gmailId', 'resendId', 'resendMessageId', 'messageId', 'emailId'] as const) {
    const v = payload[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

export type ContactEmailEngagement = {
  /** Distinct emails this contact was sent (counts 'sent' rows). */
  sent: number
  /** Provider-confirmed deliveries. */
  delivered: number
  /** Total opens recorded (one row per email per person, idempotent). */
  opens: number
  /** Total clicks recorded. */
  clicks: number
  /** Bounce / complaint / unsubscribe — deliverability flags worth surfacing. */
  bounces: number
  complaints: number
  unsubscribes: number
  /** ISO timestamp of the most recent open, or null. */
  lastOpenAt: string | null
  /** ISO timestamp of the most recent click, or null. */
  lastClickAt: string | null
  /** Whether any engagement row exists at all (drives the empty state). */
  hasAny: boolean
  /** One row per send to this person, newest first. */
  sends: ContactEmailSend[]
}

const EMPTY: ContactEmailEngagement = {
  sent: 0,
  delivered: 0,
  opens: 0,
  clicks: 0,
  bounces: 0,
  complaints: 0,
  unsubscribes: 0,
  lastOpenAt: null,
  lastClickAt: null,
  hasAny: false,
  sends: [],
}

type EngagementRow = { event: string; occurred_at: string | null }

/**
 * Fold the raw event rows into the typed summary. Pure — exported for the unit
 * test so the aggregation is verified without touching the DB.
 */
export function summarizeEmailEngagement(rows: EngagementRow[]): ContactEmailEngagement {
  if (!rows || rows.length === 0) return EMPTY
  const out: ContactEmailEngagement = { ...EMPTY, hasAny: true }
  for (const r of rows) {
    const ev = r.event as EmailEvent
    const ts = r.occurred_at ?? null
    switch (ev) {
      case 'sent':
        out.sent++
        break
      case 'delivered':
        out.delivered++
        break
      case 'open':
        out.opens++
        if (ts && (!out.lastOpenAt || ts > out.lastOpenAt)) out.lastOpenAt = ts
        break
      case 'click':
        out.clicks++
        if (ts && (!out.lastClickAt || ts > out.lastClickAt)) out.lastClickAt = ts
        break
      case 'bounce':
        out.bounces++
        break
      case 'complaint':
        out.complaints++
        break
      case 'unsubscribe':
        out.unsubscribes++
        break
      default:
        break
    }
  }
  return out
}

/**
 * The contact's email engagement, read live from email_events. Returns the empty
 * summary (all zeros, hasAny=false) when the contact has no recorded email
 * events — never a fabricated metric.
 */
async function readPersonEmailEvents(
  sb: ReturnType<typeof createServiceClient>,
  personId: number,
): Promise<RawEmailEventRow[] | null> {
  const keyed: RawEmailEventRow[] = []
  for (let from = 0; from < 80_000; from += PAGE) {
    const { data, error } = await sb
      .from('email_events')
      .select(EVENT_SELECT)
      .eq('person_id', personId)
      .order('occurred_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return null
    const page = (data ?? []) as RawEmailEventRow[]
    keyed.push(...page)
    if (page.length < PAGE) break
  }

  const messageIds = [
    ...new Set(keyed.map((r) => (r.message_id ?? '').trim()).filter((id) => id.length > 0)),
  ]
  const extras: RawEmailEventRow[] = []
  for (let i = 0; i < messageIds.length; i += IN_CHUNK) {
    const slice = messageIds.slice(i, i + IN_CHUNK)
    for (let from = 0; from < 80_000; from += PAGE) {
      const { data, error } = await sb
        .from('email_events')
        .select(EVENT_SELECT)
        .in('message_id', slice)
        .is('email_key', null)
        .order('occurred_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) break
      const page = (data ?? []) as RawEmailEventRow[]
      extras.push(...page)
      if (page.length < PAGE) break
    }
  }
  const seen = new Set<string>()
  const unique: RawEmailEventRow[] = []
  for (const r of [...keyed, ...extras]) {
    const id = `${(r.message_id ?? '').trim()}|${r.event}|${(r.recipient_email ?? '').trim().toLowerCase()}|${r.occurred_at}`
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(r)
  }
  return inheritEmailKeys(unique)
}

function toSend(
  row: ReturnType<typeof collapseSendLog>[number],
  lastSiteAt: string | null,
): ContactEmailSend {
  const sentAt = row.sentAtIso
  return {
    key: row.key,
    emailKey: row.emailKey,
    messageId: row.messageId,
    subject: row.subject,
    sentAt,
    deliveredAt: row.deliveredAtIso,
    openedAt: row.openedAtIso,
    clickedAt: row.clickedAtIso,
    bouncedAt: row.bouncedAtIso,
    latestEvent: row.latestEvent,
    campaignJobId: campaignJobIdFromEmailKey(row.emailKey),
    lastSiteAt,
    visitedAfterSend: Boolean(lastSiteAt && sentAt && lastSiteAt >= sentAt),
  }
}

/**
 * The contact's email engagement, read live from email_events. Returns the empty
 * summary (all zeros, hasAny:false) when the contact has no recorded email
 * events — never a fabricated metric.
 */
export async function getContactEmailEngagement(
  personId: number,
): Promise<ContactEmailEngagement> {
  if (!Number.isFinite(personId) || personId <= 0) return EMPTY
  const sb = createServiceClient()
  const rows = await readPersonEmailEvents(sb, personId)
  if (rows == null) return EMPTY
  const summary = summarizeEmailEngagement(rows)
  if (!summary.hasAny) return EMPTY
  const lastSiteAt = (await readLastSiteByPerson(sb, [personId])).get(personId) ?? null
  return { ...summary, sends: collapseSendLog(rows).map((r) => toSend(r, lastSiteAt)) }
}
