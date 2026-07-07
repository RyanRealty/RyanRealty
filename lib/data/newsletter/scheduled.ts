import 'server-only'
import { createServiceClient } from '@/lib/data/client'

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
 * a draft — a concurrent send/schedule already moved it.
 */
export async function scheduleNewsletter(id: string, scheduledAtIso: string): Promise<boolean> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('newsletters')
    .update({ status: 'scheduled', scheduled_at: scheduledAtIso, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
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
