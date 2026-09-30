/**
 * marketReportSends — the per-send record of the market-report product
 * (crm_report_sends, migration 20260929230000).
 *
 * One row per attempt: status sent / failed / held, the clean html and text as
 * sent (no open pixel, no click wraps: the no-login web view and the archive
 * serve these, and reading an old report must never count as an open), and
 * the figures trace, where an admin audits any number that went out
 * (CLAUDE.md §0).
 *
 * email_key is UNIQUE: an insert on an existing key is a no-op (inserted:
 * false). The sender leans on that twice: a held row keyed per due cycle is
 * recorded once however many cron ticks see it, and a retried send never
 * writes a second row for the same attempt.
 *
 * DAL boundary (G1): every raw .from('crm_report_sends') lives here. Service
 * role; the table is RLS-on with no policy. Reads never throw (an unreadable
 * table reads as empty); writes return a result flag.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type ReportSendKind = 'scheduled' | 'manual' | 'preview'
export type ReportSendStatus = 'sent' | 'failed' | 'held'
export type ReportHoldReason = 'awaiting-approval' | 'stale-data' | 'suppressed' | 'no-email' | 'no-data'

export type ReportSendInsert = {
  subscriptionId: number | null
  personId: number
  emailKey: string
  broker: string | null
  kind: ReportSendKind
  status: ReportSendStatus
  holdReason?: ReportHoldReason | null
  error?: string | null
  messageId?: string | null
  recipientEmail?: string | null
  attemptedAt?: string
  sentAt?: string | null
  frequency?: string | null
  areas?: readonly string[]
  subject?: string | null
  html?: string | null
  plainText?: string | null
  figures?: readonly unknown[]
}

/** A send as the admin list and the web view read it (no html in the list). */
export type ReportSendSummary = {
  id: number
  subscriptionId: number | null
  personId: number
  emailKey: string
  broker: string | null
  kind: ReportSendKind
  status: ReportSendStatus
  holdReason: string | null
  error: string | null
  messageId: string | null
  recipientEmail: string | null
  attemptedAt: string
  sentAt: string | null
  frequency: string | null
  areas: string[]
  subject: string | null
}

export type ReportSendRecord = ReportSendSummary & {
  html: string | null
  plainText: string | null
  figures: unknown[]
}

const SUMMARY_COLS =
  'id, subscription_id, person_id, email_key, broker, kind, status, hold_reason, error, message_id, recipient_email, attempted_at, sent_at, frequency, areas, subject'
const RECORD_COLS = `${SUMMARY_COLS}, html, plain_text, figures`

type Row = {
  id: number
  subscription_id: number | null
  person_id: number
  email_key: string
  broker: string | null
  kind: string
  status: string
  hold_reason: string | null
  error: string | null
  message_id: string | null
  recipient_email: string | null
  attempted_at: string
  sent_at: string | null
  frequency: string | null
  areas: string[] | null
  subject: string | null
  html?: string | null
  plain_text?: string | null
  figures?: unknown
}

function toSummary(r: Row): ReportSendSummary {
  return {
    id: Number(r.id),
    subscriptionId: r.subscription_id == null ? null : Number(r.subscription_id),
    personId: Number(r.person_id),
    emailKey: r.email_key,
    broker: r.broker,
    kind: r.kind as ReportSendKind,
    status: r.status as ReportSendStatus,
    holdReason: r.hold_reason,
    error: r.error,
    messageId: r.message_id,
    recipientEmail: r.recipient_email,
    attemptedAt: r.attempted_at,
    sentAt: r.sent_at,
    frequency: r.frequency,
    areas: Array.isArray(r.areas) ? r.areas.filter((a): a is string => typeof a === 'string') : [],
    subject: r.subject,
  }
}

function toRecord(r: Row): ReportSendRecord {
  return {
    ...toSummary(r),
    html: r.html ?? null,
    plainText: r.plain_text ?? null,
    figures: Array.isArray(r.figures) ? r.figures : [],
  }
}

/**
 * Insert one send row. A row whose email_key already exists is left alone
 * (inserted: false) — the idempotency every caller relies on. Never throws.
 */
export async function insertMarketReportSend(
  row: ReportSendInsert,
): Promise<{ ok: true; inserted: boolean } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient()
    const { count, error } = await sb.from('crm_report_sends').upsert(
      {
        subscription_id: row.subscriptionId,
        person_id: row.personId,
        email_key: row.emailKey,
        broker: row.broker,
        kind: row.kind,
        status: row.status,
        hold_reason: row.holdReason ?? null,
        error: row.error ? row.error.slice(0, 2000) : null,
        message_id: row.messageId ?? null,
        recipient_email: row.recipientEmail ?? null,
        attempted_at: row.attemptedAt ?? new Date().toISOString(),
        sent_at: row.sentAt ?? null,
        frequency: row.frequency ?? null,
        areas: [...(row.areas ?? [])],
        subject: row.subject ?? null,
        html: row.html ?? null,
        plain_text: row.plainText ?? null,
        figures: [...(row.figures ?? [])],
      },
      { onConflict: 'email_key', ignoreDuplicates: true, count: 'exact' },
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true, inserted: (count ?? 0) > 0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Settle a claimed send: the provider's answer (sent with a message id, or
 * failed with the error). Scoped by email_key. Never throws.
 */
export async function settleMarketReportSend(
  emailKey: string,
  patch: {
    status: ReportSendStatus
    messageId?: string | null
    sentAt?: string | null
    error?: string | null
    holdReason?: ReportHoldReason | null
    /** The email as prepared (still no tracking), when it differs from the claim. */
    html?: string | null
    plainText?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient()
    const fields: Record<string, unknown> = {
      status: patch.status,
      message_id: patch.messageId ?? null,
      sent_at: patch.status === 'sent' ? patch.sentAt ?? new Date().toISOString() : null,
      error: patch.error ? patch.error.slice(0, 2000) : null,
      hold_reason: patch.status === 'held' ? patch.holdReason ?? 'suppressed' : null,
    }
    if (patch.html != null) fields.html = patch.html
    if (patch.plainText != null) fields.plain_text = patch.plainText
    const { error } = await sb
      .from('crm_report_sends')
      .update(fields)
      .eq('email_key', emailKey)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** One send by its email_key, with the stored html/text and figures. Null on a miss or error. */
export async function getMarketReportSendByEmailKey(emailKey: string): Promise<ReportSendRecord | null> {
  const key = (emailKey ?? '').trim()
  if (!key) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb.from('crm_report_sends').select(RECORD_COLS).eq('email_key', key).maybeSingle()
    if (error || !data) return null
    return toRecord(data as unknown as Row)
  } catch {
    return null
  }
}

/** One send by id, with the stored html/text and figures (the admin view). */
export async function getMarketReportSendById(id: number): Promise<ReportSendRecord | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb.from('crm_report_sends').select(RECORD_COLS).eq('id', id).maybeSingle()
    if (error || !data) return null
    return toRecord(data as unknown as Row)
  } catch {
    return null
  }
}

/**
 * A person's sends, newest first. `kinds` narrows (the contact's own archive
 * lists scheduled + manual sends that went out; the admin card lists all).
 */
export async function listMarketReportSendsForPerson(
  personId: number,
  opts: { kinds?: readonly ReportSendKind[]; statuses?: readonly ReportSendStatus[]; limit?: number } = {},
): Promise<ReportSendSummary[]> {
  if (!Number.isInteger(personId) || personId <= 0) return []
  try {
    const sb = createServiceClient()
    let q = sb.from('crm_report_sends').select(SUMMARY_COLS).eq('person_id', personId)
    if (opts.kinds?.length) q = q.in('kind', [...opts.kinds])
    if (opts.statuses?.length) q = q.in('status', [...opts.statuses])
    const { data, error } = await q
      .order('attempted_at', { ascending: false })
      .limit(Math.min(200, Math.max(1, opts.limit ?? 50)))
    if (error || !data) {
      if (error) console.error('[listMarketReportSendsForPerson]', error.message)
      return []
    }
    return (data as unknown as Row[]).map(toSummary)
  } catch (e) {
    console.error('[listMarketReportSendsForPerson]', e instanceof Error ? e.message : String(e))
    return []
  }
}

/** When this person last actually received a report (scheduled or manual). Null when never. */
export async function getLatestDeliveredReportAt(personId: number): Promise<string | null> {
  const [latest] = await listMarketReportSendsForPerson(personId, {
    kinds: ['scheduled', 'manual'],
    statuses: ['sent'],
    limit: 1,
  })
  return latest?.sentAt ?? null
}

/** The most recent preview that reached the broker's inbox for this person. */
export async function getLatestReportPreview(personId: number): Promise<ReportSendSummary | null> {
  const [latest] = await listMarketReportSendsForPerson(personId, { kinds: ['preview'], statuses: ['sent'], limit: 1 })
  return latest ?? null
}

export type ReportSendEngagement = {
  delivered: boolean
  opened: number
  clicked: number
  bounced: boolean
  complained: boolean
  unsubscribed: boolean
}

export function emptySendEngagement(): ReportSendEngagement {
  return { delivered: false, opened: 0, clicked: 0, bounced: false, complained: false, unsubscribed: false }
}

/** Most events read per call; a report's opens and clicks sit far below this. */
const ENGAGEMENT_EVENT_CAP = 5000

/**
 * Lifecycle events per send, joined by email_key (email_events is the single
 * store every tracker and webhook writes; delivered and bounce rows inherit the
 * key from the `sent` row by message id). One IN query, paged by id so a busy
 * report never truncates at PostgREST's 1,000-row response ceiling (ci:row-cap).
 * An error on any page returns what was read before it, logged.
 */
export async function getReportSendEngagement(
  emailKeys: readonly string[],
): Promise<Map<string, ReportSendEngagement>> {
  const out = new Map<string, ReportSendEngagement>()
  const keys = [...new Set(emailKeys.map((k) => (k ?? '').trim()).filter(Boolean))].slice(0, 200)
  if (keys.length === 0) return out
  try {
    const sb = createServiceClient()
    const { rows, error } = await fetchPagedRows<{ email_key: string | null; event: string }>(
      (from, to) =>
        sb
          .from('email_events')
          .select('email_key, event')
          .in('email_key', keys)
          .in('event', ['delivered', 'open', 'click', 'bounce', 'complaint', 'unsubscribe'])
          .order('id', { ascending: true })
          .range(from, to),
      ENGAGEMENT_EVENT_CAP,
    )
    if (error) console.error('[getReportSendEngagement]', error.message)
    for (const row of rows) {
      const key = row.email_key ?? ''
      if (!key) continue
      const agg = out.get(key) ?? emptySendEngagement()
      if (row.event === 'delivered') agg.delivered = true
      else if (row.event === 'open') agg.opened += 1
      else if (row.event === 'click') agg.clicked += 1
      else if (row.event === 'bounce') agg.bounced = true
      else if (row.event === 'complaint') agg.complained = true
      else if (row.event === 'unsubscribe') agg.unsubscribed = true
      out.set(key, agg)
    }
    return out
  } catch (e) {
    console.error('[getReportSendEngagement]', e instanceof Error ? e.message : String(e))
    return out
  }
}
