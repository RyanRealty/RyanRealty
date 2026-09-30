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
 * a draft — a concurrent send/schedule already moved it — or, given
 * `expectedUpdatedAt`, when the draft changed after it was read: the pre-send
 * checks passed on that version, so another is never scheduled in its place
 * (a monthly report email is rebuilt when its report is republished).
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
 * Monthly market report emails still open (draft, scheduled, or going out),
 * newest first: the daily backstop checks each against its edition. The
 * newest 24 months are plenty; an email older than that is not going out.
 */
export async function listOpenEditionEmailDrafts(prefix: string): Promise<Array<{ id: string; created_by: string }>> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('newsletters')
    .select('id,created_by')
    .like('created_by', `${prefix}%`)
    .in('status', ['draft', 'scheduled', 'sending'])
    .order('created_by', { ascending: false })
    .limit(24)
  if (error) throw new Error(`listOpenEditionEmailDrafts: ${error.message}`)
  return (data ?? []) as Array<{ id: string; created_by: string }>
}

/**
 * Take a draft or scheduled issue out of reach for good, in one conditional
 * update: canceled, and its producer marker moved to `retiredCreatedBy` so a
 * replacement can take the live one (a monthly market report email whose
 * report was republished with new figures). False when it was neither a
 * draft nor scheduled any more (the send cron claimed it, or it is gone).
 */
export async function retireNewsletterDraft(id: string, retiredCreatedBy: string): Promise<boolean> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('newsletters')
    .update({ status: 'canceled', created_by: retiredCreatedBy, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['draft', 'scheduled'])
    .select('id')
  if (error) throw new Error(`retireNewsletterDraft: ${error.message}`)
  return (data?.length ?? 0) > 0
}
