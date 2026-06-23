/**
 * recordGpcSuppression -- record a GPC opt-out as a crm_suppressions row
 * (CONTACT360 Phase 8.1).
 *
 * When a visitor sends a Global Privacy Control opt-out AND that visitor is
 * already identified to a CRM person (visitor_sessions.crm_person_id is set),
 * the opt-out is durable: we write a channel='all', reason='gpc-opt-out'
 * suppression so the person is excluded from EVERY outbound send path (the
 * isSuppressed chokepoint) AND from the Meta audience (getAudienceEligiblePeople
 * filters out anyone suppressed). One signal, one row, consistent everywhere.
 *
 * DAL boundary (G1): the raw .from() write lives here, inside lib/data/. Service
 * role (the tracking route has no user session). Idempotent: a same-person
 * gpc-opt-out row is written at most once (we check before insert) so repeated
 * GPC page views don't pile up duplicate rows.
 *
 * NON-BLOCKING by contract: callers wrap this in try/catch and never let a
 * failure here break the tracking response. This function additionally swallows
 * its own errors and returns a result flag rather than throwing.
 */

import { createServiceClient } from '@/lib/supabase/service'

export const GPC_SUPPRESSION_REASON = 'gpc-opt-out'
export const GPC_SUPPRESSION_CHANNEL = 'all' as const

export type RecordGpcSuppressionResult =
  | { ok: true; recorded: boolean }
  | { ok: false; error: string }

/**
 * Ensure a GPC opt-out suppression exists for the given CRM person.
 *
 * Returns { recorded: true } when a new row was written, { recorded: false }
 * when one already existed (idempotent). Never throws.
 */
export async function recordGpcSuppression(
  crmPersonId: number,
): Promise<RecordGpcSuppressionResult> {
  if (typeof crmPersonId !== 'number' || !Number.isFinite(crmPersonId)) {
    return { ok: false, error: 'invalid crmPersonId' }
  }
  try {
    const sb = createServiceClient()

    // Idempotency: only insert if no gpc-opt-out 'all' row already exists for
    // this person. crm_suppressions has no unique constraint on
    // (person_id, channel, reason), so we guard with a read first.
    const { data: existing, error: readErr } = await sb
      .from('crm_suppressions')
      .select('id')
      .eq('person_id', crmPersonId)
      .eq('channel', GPC_SUPPRESSION_CHANNEL)
      .eq('reason', GPC_SUPPRESSION_REASON)
      .limit(1)
    if (readErr) return { ok: false, error: readErr.message }
    if (existing && existing.length > 0) return { ok: true, recorded: false }

    const { error: insertErr } = await sb.from('crm_suppressions').insert({
      person_id: crmPersonId,
      channel: GPC_SUPPRESSION_CHANNEL,
      reason: GPC_SUPPRESSION_REASON,
      source: 'gpc',
      value: null,
    })
    if (insertErr) return { ok: false, error: insertErr.message }
    return { ok: true, recorded: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
