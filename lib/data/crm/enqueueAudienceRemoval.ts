/**
 * enqueueAudienceRemoval -- mark a person for removal from the Meta CRM Custom
 * Audience (CONTACT360 Phase 8.4).
 *
 * Called fire-and-forget from addSuppression: a freshly-suppressed contact must
 * be DELETED from the 'Ryan Realty CRM Leads' audience, not merely excluded from
 * the next upload. We write a pending marker to meta_audience_removal_queue; the
 * meta-audience-sync cron drains it via removeFromCrmAudience.
 *
 * NON-BLOCKING + FAIL-CLOSED-PRESERVING by contract: a queue/Meta failure must
 * NEVER break addSuppression (the consent chokepoint). This function swallows
 * its own errors and returns a flag rather than throwing, and the caller wraps
 * it in try/catch as a second belt. The suppression row is the load-bearing
 * record; the queue is a best-effort downstream side effect.
 *
 * DAL boundary (G1): the raw .from() write lives here, inside lib/data/. Service
 * role. Idempotent: relies on the partial unique index (one 'pending' row per
 * person) and treats a unique-violation as a successful no-op.
 *
 * NOTE: meta_audience_removal_queue ships as a FLAGGED migration (not applied in
 * this delivery). Until it exists, the insert returns a relation-missing error,
 * which this function reports as { ok:false } WITHOUT throwing -- so wiring it
 * into addSuppression now is safe before the table lands.
 */

import { createServiceClient } from '@/lib/supabase/service'

export type EnqueueAudienceRemovalResult =
  | { ok: true; enqueued: boolean }
  | { ok: false; error: string }

export async function enqueueAudienceRemoval(
  personId: number,
  reason = 'suppressed',
): Promise<EnqueueAudienceRemovalResult> {
  if (typeof personId !== 'number' || !Number.isFinite(personId)) {
    return { ok: false, error: 'invalid personId' }
  }
  try {
    const sb = createServiceClient()
    const { error } = await sb
      .from('meta_audience_removal_queue')
      .insert({ person_id: personId, reason, status: 'pending' })
    if (error) {
      // 23505 = unique_violation = a pending marker already exists -> success.
      if (error.code === '23505') return { ok: true, enqueued: false }
      return { ok: false, error: error.message }
    }
    return { ok: true, enqueued: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
