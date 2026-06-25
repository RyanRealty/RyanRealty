import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import type { EmailEvent, EmailSendType } from '@/lib/crm/email-events'

/**
 * getEmailReporting — the cached read side of the unified email reporting surface
 * (Wave 5). Every figure here traces to a real email_events query. Nothing is a
 * placeholder, a zero-under-false-copy, or a fabricated rate (CLAUDE.md §0).
 *
 * email_events is the single store every send/webhook/tracker writes to
 * (lib/crm/email-events.ts recordEmailEvent). One send produces a fan of rows as
 * its lifecycle advances: sent -> delivered -> open -> click, plus bounce /
 * complaint / unsubscribe. The readers below aggregate that fan two ways:
 *
 *   - getEmailSendLog: one row PER SEND (keyed on message_id, falling back to
 *     email_key, falling back to recipient) showing the LATEST lifecycle event
 *     for that send and when it happened — a brokerage-wide sent-email log.
 *   - getEmailEngagementSummary / getBrokerEmailEngagement /
 *     getContactEmailEngagement: honest engagement rates computed on read
 *     (opened/delivered, clicked/delivered, bounced/sent), divide-by-zero
 *     guarded to NULL (not 0) so an empty window reads "no data" rather than a
 *     fake 0%.
 *
 * Scope: every read takes an optional `broker` slug. When set (a restricted
 * broker, resolved via scopeBroker(access) at the call site), the read is
 * constrained to email_events.broker = that slug, so a non-superuser sees only
 * their own sends. When null (superuser / Matt), the read is brokerage-wide.
 *
 * DAL boundary (G1): the raw .from('email_events') reads live here. Cached
 * briefly (60s) and keyed on the filter; the email engine writes events
 * continuously, so a short TTL keeps the report current without a per-render hit.
 *
 * Fails SOFT (empty rows / null rates / unreadable:true) on an unreadable table
 * so the report renders an honest empty/zero state rather than crashing.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** The lifecycle ordering used to pick the "latest meaningful" event of a send. */
const EVENT_RANK: Record<EmailEvent, number> = {
  sent: 0,
  delivered: 1,
  open: 2,
  click: 3,
  // Terminal/negative states outrank progress — a bounce/complaint/unsubscribe
  // is the headline status of that send regardless of an earlier open.
  unsubscribe: 4,
  complaint: 5,
  bounce: 6,
}

export type EmailSendLogRow = {
  /** Stable key for the send (message_id || email_key || recipient+subject). */
  key: string
  messageId: string | null
  recipientEmail: string
  personId: number | null
  broker: string | null
  sendType: string | null
  subject: string | null
  /** The latest lifecycle event observed for this send. */
  latestEvent: EmailEvent
  /** ISO timestamp of the latest event. */
  latestAtIso: string
  /** ISO timestamp of the earliest (sent) event, when known. */
  firstAtIso: string
}

export type EmailSendLogResult = {
  rows: EmailSendLogRow[]
  /** Total distinct sends matching the filter (for pagination). */
  count: number
  unreadable: boolean
}

export type GetEmailSendLogParams = {
  /** Restrict to one broker's sends. Null/undefined = brokerage-wide. */
  broker?: string | null
  /** ISO date (inclusive lower bound on occurred_at). */
  dateFrom?: string | null
  /** ISO date (inclusive upper bound on occurred_at). */
  dateTo?: string | null
  sendType?: EmailSendType | string | null
  /** Free-text match on recipient_email or subject. */
  q?: string | null
  limit?: number
  offset?: number
}

export type EmailEngagementSummary = {
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  unsubscribed: number
  /** opened / delivered. NULL when no deliveries (never a fake 0). */
  openRate: number | null
  /** clicked / delivered. NULL when no deliveries. */
  clickRate: number | null
  /** bounced / sent. NULL when no sends. */
  bounceRate: number | null
  unreadable: boolean
}

export type GetEmailEngagementParams = {
  broker?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  sendType?: EmailSendType | string | null
}

export type BrokerEmailEngagementRow = EmailEngagementSummary & {
  /** The broker slug, or '(unattributed)' for events with no broker. */
  broker: string
}

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
/** Cap on raw events scanned per query so a huge window can't blow memory. */
const SCAN_CAP = 5000

/** Clamp a requested page size into the allowed band. PURE. */
export function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.floor(limit as number))
}

/** Clamp an offset to a non-negative integer. PURE. */
export function clampOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset) || (offset ?? 0) <= 0) return 0
  return Math.floor(offset as number)
}

/**
 * Honest rate: numerator / denominator, or NULL when the denominator is zero.
 * NEVER returns 0 for an empty denominator — a 0% open rate on zero deliveries
 * is a lie (CLAUDE.md §0). Result is a fraction in [0,1]; format at the edge.
 * PURE.
 */
export function safeRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(denominator) || denominator <= 0) return null
  if (!Number.isFinite(numerator) || numerator < 0) return null
  return numerator / denominator
}

/** Format a fraction-in-[0,1] rate (or null) as a display percent string. PURE. */
export function formatRate(rate: number | null): string {
  if (rate === null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

/** The stable per-send key: message_id, else email_key, else recipient+subject. PURE. */
export function sendKey(row: {
  message_id?: string | null
  email_key?: string | null
  recipient_email: string
  subject?: string | null
}): string {
  const mid = (row.message_id ?? '').trim()
  if (mid) return `mid:${mid}`
  const ek = (row.email_key ?? '').trim()
  if (ek) return `ek:${ek}`
  const recip = (row.recipient_email ?? '').trim().toLowerCase()
  const subj = (row.subject ?? '').trim().toLowerCase()
  return `rs:${recip}|${subj}`
}

/** A raw email_events row as the readers select it. */
export type RawEmailEventRow = {
  message_id: string | null
  recipient_email: string
  person_id: number | null
  broker: string | null
  send_type: string | null
  event: string
  email_key: string | null
  subject: string | null
  occurred_at: string
}

/**
 * Recover the TRUE send_type for every event by joining lifecycle events back to
 * the original `sent` row by message_id. PURE — exported for tests.
 *
 * The send path (lib/crm/market-report-send.ts, bulk-handlers/email-cohort.ts)
 * writes the `sent` event with the real send_type ('market-report', 'campaign',
 * 'sequence', ...). The Resend webhook then writes the delivered/open/click/
 * bounce/complaint lifecycle events ALL with send_type 'other' (it has no idea
 * what kind of send produced them). Reporting that trusts each row's stored
 * send_type therefore sees opens/clicks/bounces as 'other', so a type-filtered
 * send log or a per-type KPI strip misses the true engagement.
 *
 * This builds message_id -> realSendType from any row that carries a concrete
 * (non-'other', non-empty) send_type, preferring the `sent` event's value, then
 * overwrites every row sharing that message_id. Rows with no message_id, or
 * whose message_id never produced a concrete send_type, are returned unchanged.
 */
export function recoverSendTypes(rows: RawEmailEventRow[]): RawEmailEventRow[] {
  const byMessage = new Map<string, string>()
  for (const r of rows) {
    const mid = (r.message_id ?? '').trim()
    if (!mid) continue
    const st = (r.send_type ?? '').trim()
    if (!st || st === 'other') continue
    // The `sent` event is the authoritative source of the send_type; let it win
    // over any other concrete value seen for the same message.
    if (r.event === 'sent' || !byMessage.has(mid)) byMessage.set(mid, st)
  }
  if (byMessage.size === 0) return rows
  return rows.map((r) => {
    const mid = (r.message_id ?? '').trim()
    const real = mid ? byMessage.get(mid) : undefined
    return real && real !== (r.send_type ?? '').trim() ? { ...r, send_type: real } : r
  })
}

/** Keep only rows whose (recovered) send_type matches the requested filter.
 *  A null/empty filter is a no-op. PURE — exported for tests. */
export function filterBySendType(
  rows: RawEmailEventRow[],
  sendType: string | null | undefined,
): RawEmailEventRow[] {
  const want = (sendType ?? '').trim()
  if (!want) return rows
  return rows.filter((r) => (r.send_type ?? '').trim() === want)
}

/**
 * Collapse a fan of raw events into one log row PER SEND, picking the latest
 * lifecycle event (by EVENT_RANK, tie-broken by occurred_at). PURE — exported
 * for the test. Rows come in newest-first; we keep the highest-ranked event and
 * track the first/last timestamps seen.
 */
export function collapseSendLog(rows: RawEmailEventRow[]): EmailSendLogRow[] {
  const byKey = new Map<string, EmailSendLogRow>()
  for (const r of rows) {
    const ev = r.event as EmailEvent
    if (!(ev in EVENT_RANK)) continue
    const key = sendKey(r)
    const at = r.occurred_at
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        key,
        messageId: r.message_id,
        recipientEmail: r.recipient_email,
        personId: r.person_id,
        broker: r.broker,
        sendType: r.send_type,
        subject: r.subject,
        latestEvent: ev,
        latestAtIso: at,
        firstAtIso: at,
      })
      continue
    }
    // Track the time window across all events of the send.
    if (at < existing.firstAtIso) existing.firstAtIso = at
    if (at > existing.latestAtIso) existing.latestAtIso = at
    // Promote the headline event when this one ranks higher, or ranks equal but
    // happened later.
    const better =
      EVENT_RANK[ev] > EVENT_RANK[existing.latestEvent] ||
      (EVENT_RANK[ev] === EVENT_RANK[existing.latestEvent] && at >= existing.latestAtIso)
    if (better) {
      existing.latestEvent = ev
      // Carry the richest metadata seen (a later event may fill a null subject).
      existing.messageId = existing.messageId ?? r.message_id
      existing.personId = existing.personId ?? r.person_id
      existing.broker = existing.broker ?? r.broker
      existing.sendType = existing.sendType ?? r.send_type
      existing.subject = existing.subject ?? r.subject
    }
  }
  // Newest send first by its latest event time.
  return [...byKey.values()].sort((a, b) => (a.latestAtIso < b.latestAtIso ? 1 : -1))
}

/**
 * Tally a fan of raw events into an engagement summary with honest rates. PURE.
 * Distinct-send semantics: a send is counted once per lifecycle stage even if a
 * webhook fired the same event twice (dedupe_key already collapses true dupes at
 * write time, but a belt-and-suspenders distinct-by-(key,event) here keeps the
 * math correct against any historical double-row).
 */
export function summarizeEngagement(rows: RawEmailEventRow[]): EmailEngagementSummary {
  const seen = new Set<string>()
  let sent = 0
  let delivered = 0
  let opened = 0
  let clicked = 0
  let bounced = 0
  let complained = 0
  let unsubscribed = 0
  for (const r of rows) {
    const ev = r.event as EmailEvent
    if (!(ev in EVENT_RANK)) continue
    const dk = `${sendKey(r)}|${ev}`
    if (seen.has(dk)) continue
    seen.add(dk)
    switch (ev) {
      case 'sent':
        sent += 1
        break
      case 'delivered':
        delivered += 1
        break
      case 'open':
        opened += 1
        break
      case 'click':
        clicked += 1
        break
      case 'bounce':
        bounced += 1
        break
      case 'complaint':
        complained += 1
        break
      case 'unsubscribe':
        unsubscribed += 1
        break
    }
  }
  // Rate denominators: opens/clicks measured against deliveries (an undelivered
  // email can't be opened). Bounce measured against sends. Guard-to-null so an
  // empty window never reads a fake 0%.
  return {
    sent,
    delivered,
    opened,
    clicked,
    bounced,
    complained,
    unsubscribed,
    openRate: safeRate(opened, delivered),
    clickRate: safeRate(clicked, delivered),
    bounceRate: safeRate(bounced, sent),
    unreadable: false,
  }
}

// ── Query layer ──────────────────────────────────────────────────────────────

const EMAIL_REPORTING_TAG = 'crm-email-reporting' as const

/** Build a filtered email_events query shared by the readers.
 *
 * NOTE: send_type is deliberately NOT filtered here. Lifecycle events
 * (open/click/bounce) are stored with send_type 'other' by the webhook; their
 * true type is recovered in memory via recoverSendTypes (join to the `sent` row
 * by message_id) and THEN filtered with filterBySendType. Filtering send_type at
 * the DB level would drop every 'other' lifecycle row before recovery, so a
 * type-filtered report would show sends with zero opens/clicks. */
function buildEventsQuery(
  sb: ReturnType<typeof createServiceClient>,
  params: { broker?: string | null; dateFrom?: string | null; dateTo?: string | null; q?: string | null },
) {
  let query = sb
    .from('email_events')
    .select('message_id,recipient_email,person_id,broker,send_type,event,email_key,subject,occurred_at')

  const broker = params.broker?.trim()
  if (broker) query = query.eq('broker', broker)

  const from = params.dateFrom?.trim()
  if (from) query = query.gte('occurred_at', from)
  const to = params.dateTo?.trim()
  if (to) query = query.lte('occurred_at', to)

  const q = params.q?.trim().toLowerCase()
  if (q) query = query.or(`recipient_email.ilike.%${q}%,subject.ilike.%${q}%`)

  return query
}

async function readSendLog(params: GetEmailSendLogParams): Promise<EmailSendLogResult> {
  const sb = createServiceClient()
  const limit = clampLimit(params.limit)
  const offset = clampOffset(params.offset)

  const { data, error } = await buildEventsQuery(sb, params)
    .order('occurred_at', { ascending: false })
    .limit(SCAN_CAP)

  if (error || !data) {
    if (error) console.error('[getEmailSendLog]', error.message)
    return { rows: [], count: 0, unreadable: true }
  }

  // Recover the true send_type (join lifecycle rows to their `sent` row by
  // message_id) BEFORE the optional type filter, so the type-filtered send log
  // shows true open/click/bounce for the selected type instead of dropping them.
  const recovered = recoverSendTypes(data as RawEmailEventRow[])
  const scoped = filterBySendType(recovered, params.sendType)

  // Collapse the event fan to one row per send, then page in memory. We scan a
  // capped window (SCAN_CAP) so a single page is correct against recent sends;
  // the count is the distinct-send total within that window.
  const collapsed = collapseSendLog(scoped)
  const page = collapsed.slice(offset, offset + limit)
  return { rows: page, count: collapsed.length, unreadable: false }
}

async function readEngagement(params: GetEmailEngagementParams): Promise<EmailEngagementSummary> {
  const sb = createServiceClient()
  const { data, error } = await buildEventsQuery(sb, params)
    .order('occurred_at', { ascending: false })
    .limit(SCAN_CAP)

  if (error || !data) {
    if (error) console.error('[getEmailEngagementSummary]', error.message)
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      openRate: null,
      clickRate: null,
      bounceRate: null,
      unreadable: true,
    }
  }
  const recovered = recoverSendTypes(data as RawEmailEventRow[])
  return summarizeEngagement(filterBySendType(recovered, params.sendType))
}

async function readBrokerEngagement(params: GetEmailEngagementParams): Promise<BrokerEmailEngagementRow[]> {
  const sb = createServiceClient()
  const { data, error } = await buildEventsQuery(sb, params)
    .order('occurred_at', { ascending: false })
    .limit(SCAN_CAP)

  // Throw on a real DB error (never fake "no engagement" from a failed read, §0);
  // a genuine empty result still returns [].
  if (error) throw new Error(`[getBrokerEmailEngagement] ${error.message}`)
  if (!data) return []

  // Recover true send_type then apply the optional type filter before bucketing,
  // so per-broker rates reflect the selected send type's real lifecycle events.
  const recovered = recoverSendTypes(data as RawEmailEventRow[])
  const scoped = filterBySendType(recovered, params.sendType)

  // Bucket the events by broker, then summarize each bucket honestly.
  const buckets = new Map<string, RawEmailEventRow[]>()
  for (const r of scoped) {
    const b = (r.broker ?? '').trim() || '(unattributed)'
    const arr = buckets.get(b)
    if (arr) arr.push(r)
    else buckets.set(b, [r])
  }
  return [...buckets.entries()]
    .map(([broker, rows]) => ({ broker, ...summarizeEngagement(rows) }))
    .sort((a, b) => b.sent - a.sent || a.broker.localeCompare(b.broker))
}

// ── Cached entry points ──────────────────────────────────────────────────────

function cacheKeyParts(p: {
  broker?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  sendType?: string | null
  q?: string | null
  limit?: number
  offset?: number
}): string[] {
  return [
    p.broker?.trim() || 'all',
    p.dateFrom?.trim() || 'none',
    p.dateTo?.trim() || 'none',
    p.sendType?.trim() || 'any',
    (p.q?.trim().toLowerCase()) || 'none',
    p.limit != null ? String(clampLimit(p.limit)) : 'def',
    p.offset != null ? String(clampOffset(p.offset)) : '0',
  ]
}

/**
 * Brokerage-wide (or broker-scoped) sent-email log. One row per send showing the
 * latest lifecycle event, paged. Cached 60s, keyed on the filter.
 */
export async function getEmailSendLog(params: GetEmailSendLogParams = {}): Promise<EmailSendLogResult> {
  const cached = unstable_cache(
    () => readSendLog(params),
    ['crm-email-send-log', ...cacheKeyParts(params)],
    { tags: [EMAIL_REPORTING_TAG], revalidate: 60 },
  )
  return cached()
}

/**
 * Engagement summary (counts + honest rates) over the filtered window. Rates are
 * NULL on a zero denominator (never a fake 0%).
 */
export async function getEmailEngagementSummary(
  params: GetEmailEngagementParams = {},
): Promise<EmailEngagementSummary> {
  const cached = unstable_cache(
    () => readEngagement(params),
    ['crm-email-engagement', ...cacheKeyParts(params)],
    { tags: [EMAIL_REPORTING_TAG], revalidate: 60 },
  )
  return cached()
}

/** Engagement grouped by broker over the filtered window. */
export async function getBrokerEmailEngagement(
  params: GetEmailEngagementParams = {},
): Promise<BrokerEmailEngagementRow[]> {
  const cached = unstable_cache(
    () => readBrokerEngagement(params),
    ['crm-email-engagement-by-broker', ...cacheKeyParts(params)],
    { tags: [EMAIL_REPORTING_TAG], revalidate: 60 },
  )
  return cached()
}

// (getContactEmailEngagement for the record card lives in its own DAL reader,
//  lib/data/crm/getContactEmailEngagement.ts — the one the lead page imports.)

// ── Campaign list (DAL-routed read of email_campaigns) ───────────────────────

export type EmailCampaignRow = {
  id: string
  /** The Resend message id that created the send — joins to email_events. */
  messageId: string | null
  templateType: string | null
  subject: string | null
  /** Stored recipient count from the send (a real count, kept). */
  sentCount: number
  sentAtIso: string | null
  createdAtIso: string
}

export type EmailCampaignsResult = {
  rows: EmailCampaignRow[]
  unreadable: boolean
}

async function readCampaigns(limit: number): Promise<EmailCampaignsResult> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('email_campaigns')
    .select('id,fub_campaign_id,template_type,subject,sent_count,sent_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) {
    if (error) console.error('[getEmailCampaigns]', error.message)
    return { rows: [], unreadable: true }
  }
  const rows: EmailCampaignRow[] = (
    data as Array<{
      id: string
      fub_campaign_id: string | null
      template_type: string | null
      subject: string | null
      sent_count: number | null
      sent_at: string | null
      created_at: string
    }>
  ).map((r) => ({
    id: String(r.id),
    messageId: r.fub_campaign_id ?? null,
    templateType: r.template_type ?? null,
    subject: r.subject ?? null,
    sentCount: Number(r.sent_count ?? 0),
    sentAtIso: r.sent_at ?? null,
    createdAtIso: String(r.created_at),
  }))
  return { rows, unreadable: false }
}

/** Cached read of the recent email campaigns (the campaigns admin page). */
export async function getEmailCampaigns(limit = 50): Promise<EmailCampaignsResult> {
  const cap = clampLimit(limit)
  const cached = unstable_cache(
    () => readCampaigns(cap),
    ['crm-email-campaigns', String(cap)],
    { tags: [EMAIL_REPORTING_TAG], revalidate: 60 },
  )
  return cached()
}

// ── Per-campaign engagement (fixes the false-zero campaign stats) ─────────────

/**
 * Real per-campaign engagement, computed on read from email_events. The campaign
 * row's open_count/click_count columns are NEVER updated by the webhook (the
 * webhook writes email_events, not back to email_campaigns) — they are the
 * permanently-zero "false stats." This reader replaces them with the truth.
 *
 * Join key: email_campaigns.fub_campaign_id holds the Resend message id that
 * created the send (app/actions/admin-email.ts), which equals
 * email_events.message_id. So we fetch every event whose message_id is in the
 * campaign id set and tally per campaign with honest rates. A campaign with NO
 * matching events resolves to `tracked: false` so the page shows a truthful
 * "no engagement yet" rather than a fake 0% under a "tracked" claim.
 */
export type CampaignEngagement = EmailEngagementSummary & {
  /** Whether any email_events row was found for this campaign's message id. */
  tracked: boolean
}

/**
 * Tally one campaign's events into engagement. Returns tracked:false (and all
 * rates null) when no events exist for the campaign. PURE — exported for tests.
 */
export function summarizeCampaign(rows: RawEmailEventRow[]): CampaignEngagement {
  if (rows.length === 0) {
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      openRate: null,
      clickRate: null,
      bounceRate: null,
      unreadable: false,
      tracked: false,
    }
  }
  return { ...summarizeEngagement(rows), tracked: true }
}

async function readCampaignEngagement(
  ids: string[],
): Promise<Array<[string, CampaignEngagement]>> {
  if (ids.length === 0) return []

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('email_events')
    .select('message_id,recipient_email,person_id,broker,send_type,event,email_key,subject,occurred_at')
    .in('message_id', ids)
    .limit(SCAN_CAP)

  // Throw on a real DB error (never fake-empty campaign engagement, §0); a genuine
  // empty result still returns [].
  if (error) throw new Error(`[getCampaignEngagement] ${error.message}`)
  if (!data) return []

  // Bucket events by their message id, then summarize each bucket.
  const buckets = new Map<string, RawEmailEventRow[]>()
  for (const r of data as RawEmailEventRow[]) {
    const mid = (r.message_id ?? '').trim()
    if (!mid) continue
    const arr = buckets.get(mid)
    if (arr) arr.push(r)
    else buckets.set(mid, [r])
  }
  // Return tuples (not a Map) — unstable_cache serializes via JSON and a Map
  // would not survive. The public wrapper rebuilds the Map at the edge.
  return ids.map((id) => [id, summarizeCampaign(buckets.get(id) ?? [])] as [string, CampaignEngagement])
}

/**
 * Cached map of campaign message id -> real engagement. The page passes every
 * campaign's fub_campaign_id (the Resend message id) and renders the truth from
 * email_events instead of the stale open_count/click_count columns.
 */
export async function getCampaignEngagement(
  campaignMessageIds: string[],
): Promise<Map<string, CampaignEngagement>> {
  const ids = [...new Set(campaignMessageIds.map((s) => (s ?? '').trim()).filter(Boolean))].sort()
  if (ids.length === 0) return new Map()
  const cached = unstable_cache(
    () => readCampaignEngagement(ids),
    ['crm-campaign-engagement', ids.join(',')],
    { tags: [EMAIL_REPORTING_TAG], revalidate: 60 },
  )
  const tuples = await cached()
  return new Map(tuples)
}
