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
 * false). The sender leans on that three times: a held row keyed per due
 * cycle is recorded once however many cron ticks see it; a scheduled send is
 * keyed per subscription per due CYCLE, so two overlapping cron runs claim the
 * same row and only one of them sends (claimMarketReportSend); and a retry
 * may take that row over only once the earlier attempt settled as a failure.
 *
 * A claimed row sits as status 'failed' with error 'sending' until the
 * provider answers (SEND_CLAIM_MARK). That state is IN FLIGHT, and every
 * reader treats it as delivered (review 2026-09-30): the earlier attempt may
 * have reached the provider before the process died, and a report is never
 * sent twice on a guess. An answer that never came (the provider may have
 * accepted it) keeps the row in flight with the reason after the mark
 * ('sending (unknown outcome: …)'); it is never settled as a failure a retry
 * would re-send.
 *
 * The claim stores the EXACT provider request (payload: the from, to,
 * reply-to, subject, tracked html, text and headers, with the idempotency key
 * derived from them). A retry of a settled failure inside REPLAY_WINDOW_MS
 * replays that request byte for byte under the same key: Resend keeps a key
 * 24 hours and answers a same-key, same-payload repeat with the first result,
 * sending nothing twice. Past the window, a retry sends its own new render
 * under its own key (the same key with a different payload is refused by
 * Resend with a 409). The payload holds the contact's tracked links, so it is
 * read only by the claim and the recovery here, never by a page.
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
export type ReportHoldReason =
  | 'awaiting-approval'
  | 'stale-data'
  | 'suppressed'
  | 'no-email'
  | 'no-data'
  /** A printed figure differs from Spark by more than 1% (CLAUDE.md §0 STOP). */
  | 'spark-stop'
  /** A printed figure could not be rebuilt from Spark, or the check could not run. */
  | 'spark-unreconciled'

/** The error a claimed row carries until the provider answers: in flight. */
export const SEND_CLAIM_MARK = 'sending'

/** The error of a claimed row whose provider answer never came: still in flight. Pure. */
export function unknownOutcomeError(detail: string): string {
  return `${SEND_CLAIM_MARK} (unknown outcome: ${detail})`.slice(0, 2000)
}

/**
 * How long a stored request may be replayed under its key: inside Resend's 24
 * hours of idempotency, with an hour of margin. Past it the key is gone at
 * Resend, so a replay would be a new send without the protection, and the
 * retry sends its own fresh render under its own key instead.
 */
export const REPLAY_WINDOW_MS = 23 * 60 * 60 * 1000

/** The exact request the provider received (lib/crm/market-report-send.ts builds it). */
export type ReportEmailRequest = {
  from: string
  to: string
  replyTo: string
  subject: string
  html: string
  text: string
  headers: Record<string, string>
}

/** The stored request with its idempotency key and when it was built. */
export type ReportSendPayload = {
  v: 1
  idempotencyKey: string
  builtAt: string
  request: ReportEmailRequest
}

/** A stored request a retry may still replay byte for byte at `now`. Pure. */
export function isReplayable(payload: ReportSendPayload | null | undefined, now: Date): payload is ReportSendPayload {
  if (!payload || payload.v !== 1 || !payload.request || typeof payload.idempotencyKey !== 'string') return false
  const built = Date.parse(payload.builtAt)
  return Number.isFinite(built) && now.getTime() - built < REPLAY_WINDOW_MS
}

function parsePayload(v: unknown): ReportSendPayload | null {
  if (!v || typeof v !== 'object') return null
  const p = v as ReportSendPayload
  return p.v === 1 && p.request && typeof p.idempotencyKey === 'string' ? p : null
}

/**
 * How long an in-flight row may be another process's live attempt. A run is
 * capped at 300 seconds (the cron route's maxDuration), so a row still in
 * flight after this was left by a process that died, or its answer never
 * came. It is ABANDONED, and settled from evidence, never presumed delivered
 * or failed (review 2026-09-30; lib/crm/market-report-deliver.ts
 * recoverAbandoned): Resend's id on record, else one run replays the stored
 * request under its key inside REPLAY_WINDOW_MS, else Matt is paged and
 * nothing is sent or stamped. A younger one is another run's live attempt:
 * counted as delivered and left alone (no stamp), so if it then fails, the
 * next tick retries it.
 */
export const IN_FLIGHT_SETTLE_MS = 15 * 60 * 1000

/** An in-flight row old enough that no live process can still be sending it. Pure. */
export function inFlightAbandoned(attemptedAt: string, now: Date): boolean {
  const t = Date.parse(attemptedAt)
  return !Number.isFinite(t) || now.getTime() - t >= IN_FLIGHT_SETTLE_MS
}

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
  /** The §0 Spark cross-check this send passed (or was held on): checks, queries, verdict. */
  sparkCheck?: unknown | null
  /** The exact provider request, for a byte-for-byte replay under its key. */
  payload?: ReportSendPayload | null
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
  sparkCheck: unknown | null
}

const SUMMARY_COLS =
  'id, subscription_id, person_id, email_key, broker, kind, status, hold_reason, error, message_id, recipient_email, attempted_at, sent_at, frequency, areas, subject'
const RECORD_COLS = `${SUMMARY_COLS}, html, plain_text, figures, spark_check`

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
  spark_check?: unknown
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
    sparkCheck: r.spark_check ?? null,
  }
}

/** The fields that decide whether a send key is free, delivered, in flight or held. */
export type ReportSendState = {
  emailKey: string
  status: ReportSendStatus
  error: string | null
  sentAt: string | null
  attemptedAt: string
  holdReason: string | null
  messageId: string | null
  payload: ReportSendPayload | null
}

/**
 * A claimed row the provider has not answered for yet: in flight, or its
 * answer never came (unknownOutcomeError), or the process died. Pure.
 */
export function isInFlightSend(s: Pick<ReportSendState, 'status' | 'error'>): boolean {
  return s.status === 'failed' && typeof s.error === 'string' && (s.error === SEND_CLAIM_MARK || s.error.startsWith(`${SEND_CLAIM_MARK} `))
}

/** An attempt that failed and settled: a state a retry may take over. Pure. */
export function isSettledFailure(s: Pick<ReportSendState, 'status' | 'error'>): boolean {
  return s.status === 'failed' && !isInFlightSend(s)
}

/**
 * The person's latest delivery, from their send rows (any order): a sent row
 * counts at its sent_at, and an IN-FLIGHT row counts as delivered at its
 * attempted_at (the earlier attempt may have gone out), flagged `inFlight`.
 * Previews, settled failures and holds never count. Null when none. Pure.
 */
export function latestDelivery(
  rows: ReadonlyArray<Pick<ReportSendSummary, 'emailKey' | 'kind' | 'status' | 'error' | 'sentAt' | 'attemptedAt'>>,
): { at: string; inFlight: boolean; emailKey: string } | null {
  let best: { at: string; inFlight: boolean; emailKey: string } | null = null
  let bestMs = -Infinity
  for (const r of rows) {
    if (r.kind === 'preview') continue
    const inFlight = isInFlightSend(r)
    const at = r.status === 'sent' ? r.sentAt ?? r.attemptedAt : inFlight ? r.attemptedAt : null
    const ms = at ? Date.parse(at) : NaN
    if (at && Number.isFinite(ms) && ms > bestMs) {
      best = { at, inFlight, emailKey: r.emailKey }
      bestMs = ms
    }
  }
  return best
}

/** latestDelivery's time only. Pure. */
export function latestDeliveredAt(
  rows: ReadonlyArray<Pick<ReportSendSummary, 'emailKey' | 'kind' | 'status' | 'error' | 'sentAt' | 'attemptedAt'>>,
): string | null {
  return latestDelivery(rows)?.at ?? null
}

/**
 * Insert one send row. A row whose email_key already exists is left alone
 * (inserted: false) — the idempotency every caller relies on. Never throws.
 */
export async function insertMarketReportSend(
  row: ReportSendInsert,
  opts: { refresh?: boolean } = {},
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
        spark_check: row.sparkCheck ?? null,
        payload: row.payload ?? null,
      },
      // `refresh` rewrites an existing row under the same key (a held row
      // re-checked on a later tick of the same cycle keeps the latest
      // numbers); by default an existing key is left alone.
      { onConflict: 'email_key', ignoreDuplicates: !opts.refresh, count: 'exact' },
    )
    if (error) return { ok: false, error: error.message }
    return { ok: true, inserted: (count ?? 0) > 0 }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

const STATE_COLS = 'email_key, status, error, sent_at, attempted_at, hold_reason, message_id, payload'

/** The state of the row holding a send key (with its stored request). Null when there is none or it cannot be read. */
export async function getMarketReportSendState(emailKey: string): Promise<ReportSendState | null> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb.from('crm_report_sends').select(STATE_COLS).eq('email_key', emailKey).maybeSingle()
    if (error || !data) return null
    const r = data as {
      email_key: string
      status: string
      error: string | null
      sent_at: string | null
      attempted_at: string
      hold_reason: string | null
      message_id: string | null
      payload: unknown
    }
    return {
      emailKey: r.email_key,
      status: r.status as ReportSendStatus,
      error: r.error,
      sentAt: r.sent_at,
      attemptedAt: r.attempted_at,
      holdReason: r.hold_reason,
      messageId: r.message_id ?? null,
      payload: parsePayload(r.payload),
    }
  } catch {
    return null
  }
}

export type ReportSendClaim =
  | {
      ok: true
      claimed: true
      takeover: boolean
      /** What the taken-over row was: a settled failure, or a held row (unexpected at a send key: page). */
      from: 'failed' | 'held' | null
      /** The stored request to replay byte for byte under its own key; null to send this render. */
      replay: ReportSendPayload | null
    }
  | { ok: true; claimed: false; existing: ReportSendState }
  | { ok: false; error: string }

/** PostgREST filter: a row a retry may take over (a settled failure, or a held row). */
const TAKEOVER_FILTER = `status.eq.held,error.is.null,error.not.like.${SEND_CLAIM_MARK}*`

/**
 * Claim a send key before the wire (reviews of 2026-09-30). The row is written
 * in flight (status 'failed', error SEND_CLAIM_MARK) with the stored copy,
 * the trace and the exact provider request.
 *
 *   - A new key: inserted, claimed.
 *   - A key already SENT or IN FLIGHT (an answer that never came included):
 *     not claimed; the caller gets the existing state (and treats in flight
 *     as delivered, or recovers an abandoned one from evidence).
 *   - A key whose attempt SETTLED as a failure: a retry takes it over, in ONE
 *     conditional update that matches only while the row is still settled,
 *     so two retries cannot both take it. Inside REPLAY_WINDOW_MS of the
 *     stored request, the takeover keeps the stored copy and request and
 *     hands the request back to REPLAY (same bytes, same key); past it, the
 *     row takes this render and its request (a new key).
 *   - A key HELD (holds use their own keys, so this is unexpected): nothing
 *     went out under it, so it is taken over the same way, flagged `held` so
 *     the caller pages.
 *
 * Never throws.
 */
export async function claimMarketReportSend(
  row: Omit<ReportSendInsert, 'status' | 'error' | 'holdReason' | 'messageId' | 'sentAt'>,
  now: Date = new Date(),
): Promise<ReportSendClaim> {
  const ins = await insertMarketReportSend({ ...row, status: 'failed', error: SEND_CLAIM_MARK })
  if (!ins.ok) return ins
  if (ins.inserted) return { ok: true, claimed: true, takeover: false, from: null, replay: null }
  const existing = await getMarketReportSendState(row.emailKey)
  if (!existing) return { ok: false, error: `the send key ${row.emailKey} exists but its row could not be read` }
  if (existing.status === 'sent' || isInFlightSend(existing)) return { ok: true, claimed: false, existing }
  const from: 'failed' | 'held' = existing.status === 'held' ? 'held' : 'failed'
  const replay = isReplayable(existing.payload, now) ? existing.payload : null
  const attemptedAt = row.attemptedAt ?? now.toISOString()
  const fields: Record<string, unknown> = replay
    ? { status: 'failed', error: SEND_CLAIM_MARK, hold_reason: null, message_id: null, sent_at: null, attempted_at: attemptedAt }
    : {
        subscription_id: row.subscriptionId,
        broker: row.broker,
        kind: row.kind,
        status: 'failed',
        error: SEND_CLAIM_MARK,
        hold_reason: null,
        message_id: null,
        sent_at: null,
        recipient_email: row.recipientEmail ?? null,
        attempted_at: attemptedAt,
        frequency: row.frequency ?? null,
        areas: [...(row.areas ?? [])],
        subject: row.subject ?? null,
        html: row.html ?? null,
        plain_text: row.plainText ?? null,
        figures: [...(row.figures ?? [])],
        spark_check: row.sparkCheck ?? null,
        payload: row.payload ?? null,
      }
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_report_sends')
      .update(fields)
      .eq('email_key', row.emailKey)
      .in('status', ['failed', 'held'])
      .or(TAKEOVER_FILTER)
      .select('id')
    if (error) return { ok: false, error: error.message }
    if (data && data.length > 0) return { ok: true, claimed: true, takeover: true, from, replay }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  // Another retry took it first: report what holds it now.
  const held = await getMarketReportSendState(row.emailKey)
  return held ? { ok: true, claimed: false, existing: held } : { ok: false, error: `the send key ${row.emailKey} could not be read` }
}

/**
 * Settle a claimed send with the provider's answer: sent with a message id,
 * or a failure it answered. A delivery ('sent') always lands. A failure or a
 * hold lands only on a row still in flight, so a late or duplicate settle can
 * never turn a delivered report into a failure a retry would re-send. Scoped
 * by email_key. Never throws.
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
    let q = sb.from('crm_report_sends').update(fields).eq('email_key', emailKey)
    if (patch.status !== 'sent') q = q.eq('status', 'failed').like('error', `${SEND_CLAIM_MARK}%`)
    const { error } = await q
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * The provider's answer never came (it may have accepted the email): the row
 * STAYS in flight, with the reason recorded after the mark. Only a row still
 * in flight is touched. Never throws.
 */
export async function markMarketReportSendUnknown(emailKey: string, detail: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('crm_report_sends')
      .update({ error: unknownOutcomeError(detail) })
      .eq('email_key', emailKey)
      .eq('status', 'failed')
      .like('error', `${SEND_CLAIM_MARK}%`)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Take the recovery of an ABANDONED in-flight attempt: one conditional write
 * of attempted_at that matches only while the row still carries the attempt
 * time this run read, so of two runs recovering the same attempt, one wins.
 * Never throws (a failed write is a lost race: false).
 */
export async function claimInFlightRecovery(emailKey: string, attemptedAt: string, nowIso: string): Promise<boolean> {
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_report_sends')
      .update({ attempted_at: nowIso })
      .eq('email_key', emailKey)
      .eq('attempted_at', attemptedAt)
      .eq('status', 'failed')
      .like('error', `${SEND_CLAIM_MARK}%`)
      .select('id')
    return !error && Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}

/**
 * The evidence an attempt reached the provider: the 'sent' email_events row
 * the send recorded with Resend's message id right after Resend accepted it.
 * Null when there is none (or it cannot be read).
 */
export async function getMarketReportSentEvidence(emailKey: string): Promise<{ messageId: string; at: string } | null> {
  const key = (emailKey ?? '').trim()
  if (!key) return null
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('email_events')
      .select('message_id, occurred_at')
      .eq('email_key', key)
      .eq('event', 'sent')
      .not('message_id', 'is', null)
      .order('occurred_at', { ascending: false })
      .limit(1)
    if (error || !data || data.length === 0) return null
    const r = data[0] as { message_id: string | null; occurred_at: string }
    return r.message_id ? { messageId: r.message_id, at: r.occurred_at } : null
  } catch {
    return null
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

/**
 * When this person last received a report (scheduled or manual). Null when
 * never. An in-flight row counts as delivered (latestDeliveredAt): the
 * cadence backstop must not send again while an earlier attempt may have gone
 * out (review 2026-09-30).
 */
export async function getLatestDeliveredReportAt(personId: number): Promise<string | null> {
  return (await getLatestDeliveredReport(personId))?.at ?? null
}

/** getLatestDeliveredReportAt, saying whether that delivery is still in flight, and its key. */
export async function getLatestDeliveredReport(personId: number): Promise<{ at: string; inFlight: boolean; emailKey: string } | null> {
  const rows = await listMarketReportSendsForPerson(personId, {
    kinds: ['scheduled', 'manual'],
    statuses: ['sent', 'failed'],
    limit: 25,
  })
  return latestDelivery(rows)
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
