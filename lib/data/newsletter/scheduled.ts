import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import type { NewsletterCitationEntry } from '@/lib/data/newsletter'

/**
 * Scheduled-send support (spec §4.2 UC-R5 / §13 Phase 6). The admin "Schedule"
 * control sets a newsletter to status='scheduled' with a scheduled_at; this finds
 * the ones whose time has arrived so the send cron can enqueue them. Kept in its
 * own file (raw .from() → DAL boundary) so the send-queue orchestration stays clean.
 */
export async function getDueScheduledNewsletterIds(nowIso: string): Promise<string[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('newsletters')
    .select('id')
    .eq('status', 'scheduled')
    .not('scheduled_at', 'is', null)
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(25)
  return (data ?? []).map((r) => (r as { id: string }).id)
}

/**
 * Promote a draft to scheduled in ONE conditional update (never read-then-write,
 * same posture as the CAS send lock). Returns false when the newsletter was not
 * a draft — a concurrent send/schedule already moved it, or a monthly report
 * email was replaced (canceled) because its report was republished — or, given
 * `expectedUpdatedAt`, when the draft was edited after it was read: the
 * pre-send checks passed on that version, so another is never scheduled in its
 * place.
 */
export async function scheduleNewsletter(id: string, scheduledAtIso: string, expectedUpdatedAt?: string): Promise<boolean> {
  const sb = createServiceClient()
  let query = sb
    .from('newsletters')
    .update({ status: 'scheduled', scheduled_at: scheduledAtIso, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await query
    .select('id')
  if (error) throw new Error(`scheduleNewsletter: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/**
 * Move a scheduled newsletter back to draft (the "unschedule" control).
 * Conditional on status='scheduled' so it can never yank a newsletter that the
 * send cron already promoted to sending. Returns false when nothing matched.
 */
export async function unscheduleNewsletter(id: string): Promise<boolean> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('newsletters')
    .update({ status: 'draft', scheduled_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select('id')
  if (error) throw new Error(`unscheduleNewsletter: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/**
 * Any-status subject lookup — the monthly auto-draft cron's idempotency check.
 * A month whose issue was already drafted, scheduled, or sent must not get a
 * second auto-draft.
 */
export async function findNewsletterIdBySubject(subject: string): Promise<string | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('newsletters')
    .select('id')
    .eq('subject', subject)
    .limit(1)
    .maybeSingle()
  return ((data as { id: string } | null)?.id) ?? null
}

/**
 * Any-status lookup by producer marker (created_by, which no admin form edits,
 * unlike the subject). The monthly market report email's idempotency check:
 * one draft per edition month, whatever became of it. THROWS on a failed read:
 * "none" would draft the month a second time.
 */
export type NewsletterByMarker = {
  id: string
  status: string
  citations: NewsletterCitationEntry[]
}

export async function findNewsletterByCreatedBy(createdBy: string): Promise<NewsletterByMarker | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('newsletters')
    .select('id,status,citations')
    .eq('created_by', createdBy)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`findNewsletterByCreatedBy: ${error.message}`)
  const row = data as NewsletterByMarker | null
  return row ? { id: row.id, status: row.status, citations: row.citations ?? [] } : null
}

/**
 * The months whose market report email the daily backstop checks, newest
 * first: every month with an open email (draft, scheduled, or going out), and
 * every month whose email was replaced in the last `sinceIso` window (a
 * replacement that could not be written leaves the month with no live draft,
 * and the backstop writes it). 24 of each is plenty; an email older than that
 * is not going out.
 */
export async function listEditionEmailMonthRows(prefix: string, sinceIso: string): Promise<Array<{ id: string; created_by: string }>> {
  const sb = createServiceClient()
  const [open, replaced] = await Promise.all([
    sb
      .from('newsletters')
      .select('id,created_by')
      .like('created_by', `${prefix}%`)
      .in('status', ['draft', 'scheduled', 'sending'])
      .order('created_by', { ascending: false })
      .limit(24),
    sb
      .from('newsletters')
      .select('id,created_by')
      .like('created_by', `${prefix}%:replaced:%`)
      .eq('status', 'canceled')
      .gte('updated_at', sinceIso)
      .order('created_by', { ascending: false })
      .limit(24),
  ])
  if (open.error) throw new Error(`listEditionEmailMonthRows: ${open.error.message}`)
  if (replaced.error) throw new Error(`listEditionEmailMonthRows: ${replaced.error.message}`)
  return [...(open.data ?? []), ...(replaced.data ?? [])] as Array<{ id: string; created_by: string }>
}

/**
 * The newest email of a month that was replaced (its marker is the live one
 * plus ':replaced:<id>'), or null. With no live row this means a replacement
 * that was never written: the backstop writes it. THROWS on a failed read.
 */
export async function findReplacedNewsletter(liveCreatedBy: string): Promise<{ id: string } | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('newsletters')
    .select('id')
    .like('created_by', `${liveCreatedBy}:replaced:%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`findReplacedNewsletter: ${error.message}`)
  return (data as { id: string } | null) ?? null
}

export type ReplaceNewsletterDraftResult =
  | { ok: true; id: string; previousStatus: 'draft' | 'scheduled'; touched: boolean }
  | { ok: false; status: string | null }

/**
 * Replace an open issue in ONE transaction (migration 20260930180000): the old
 * row, which must still be `expectedStatus`, is canceled and its marker moved
 * to `retiredCreatedBy`; the replacement draft takes its marker and audience.
 * { ok: false, status } when the old row moved (it is read again). THROWS on
 * a failed call, and then nothing changed.
 */
export async function replaceNewsletterDraft(input: {
  id: string
  expectedStatus: 'draft' | 'scheduled'
  retiredCreatedBy: string
  subject: string
  previewText: string | null
  bodyHtml: string | null
  bodyText: string | null
  citations: NewsletterCitationEntry[]
}): Promise<ReplaceNewsletterDraftResult> {
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('replace_newsletter_draft', {
    p_id: input.id,
    p_expected_status: input.expectedStatus,
    p_retired_created_by: input.retiredCreatedBy,
    p_subject: input.subject,
    p_preview_text: input.previewText,
    p_body_html: input.bodyHtml,
    p_body_text: input.bodyText,
    p_citations: input.citations,
  })
  if (error) throw new Error(`replaceNewsletterDraft: ${error.message}`)
  const r = (data ?? {}) as { ok?: boolean; id?: string; previous_status?: string; touched?: boolean; status?: string | null }
  if (r.ok && r.id) {
    return {
      ok: true,
      id: r.id,
      previousStatus: r.previous_status === 'scheduled' ? 'scheduled' : 'draft',
      touched: r.touched === true,
    }
  }
  return { ok: false, status: r.status ?? null }
}

/**
 * Take an open issue out of reach with no replacement, in one conditional
 * update: canceled, its marker moved to `retiredCreatedBy`, and only while it
 * is still `expectedStatus` (so the caller knows whether an approved email was
 * pulled back). For a monthly report email whose report changed and whose new
 * email cannot be built yet. False when it moved.
 */
export async function retireNewsletterDraft(
  id: string,
  expectedStatus: 'draft' | 'scheduled',
  retiredCreatedBy: string,
): Promise<boolean> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('newsletters')
    .update({ status: 'canceled', created_by: retiredCreatedBy, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', expectedStatus)
    .select('id')
  if (error) throw new Error(`retireNewsletterDraft: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/**
 * Move an open issue's §0 trace to a newer build whose printed figures are the
 * same: the citations are replaced, nothing a reader sees changes, and
 * updated_at is left alone, so a review page open on it can still approve it.
 * Only while it is a draft or scheduled (a trace of an email going out or sent
 * records what was checked when it went) and still stamped `fromStamp`.
 */
export async function restampNewsletterCitations(
  id: string,
  fromStamp: string,
  citations: NewsletterCitationEntry[],
): Promise<boolean> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('newsletters')
    .update({ citations })
    .eq('id', id)
    .in('status', ['draft', 'scheduled'])
    .eq('citations->0->>fetched_at', fromStamp)
    .select('id')
  if (error) throw new Error(`restampNewsletterCitations: ${error.message}`)
  return (data?.length ?? 0) > 0
}
