/**
 * First-broker-action stamp (P12 measurement — Matt lock: full including surfaces).
 *
 * Stored on crm_people.custom.first_broker_action_at (no schema migration) the
 * first time an outbound human-touch kind is recorded. Speed-to-lead already
 * computes from timeline; this stamp makes SLA reads O(1) and admin-visible.
 */

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

const OUTBOUND = new Set(['call', 'email_out', 'sms_out', 'voicemail', 'mms_out'])

export async function stampFirstBrokerActionIfEmpty(
  sb: SupabaseClient,
  personId: number,
  input: { kind: string; at?: string; broker?: string | null },
): Promise<boolean> {
  if (!Number.isFinite(personId) || personId <= 0) return false
  if (!OUTBOUND.has(input.kind)) return false
  // Named writer: first outbound advances Lead → Nurture (G3). No-op when the
  // person is already past Lead. Runs even when the stamp is already set.
  try {
    const { advanceJourneyStage } = await import('@/lib/data/crm/advanceJourneyStage')
    await advanceJourneyStage({ personId, trigger: 'first-outbound' })
  } catch (e) {
    console.warn('[stampFirstBrokerActionIfEmpty] journey advance failed:', e)
  }
  const at = input.at ?? new Date().toISOString()

  const { data, error } = await sb
    .from('crm_people')
    .select('custom')
    .eq('id', personId)
    .maybeSingle()
  if (error || !data) return false
  const custom = { ...((data.custom as Record<string, unknown> | null) ?? {}) }
  if (typeof custom.first_broker_action_at === 'string' && custom.first_broker_action_at) {
    return false
  }
  custom.first_broker_action_at = at
  custom.first_broker_action_kind = input.kind
  if (input.broker) custom.first_broker_action_broker = input.broker

  const { error: upErr } = await sb
    .from('crm_people')
    .update({ custom, updated_at: new Date().toISOString() })
    .eq('id', personId)
  return !upErr
}

/** Seconds from lead created (fub_created_at || created_at) to first broker action. */
export function replyLatencySeconds(person: {
  created_at?: string | null
  fub_created_at?: string | null
  custom?: Record<string, unknown> | null
}): number | null {
  const start = person.fub_created_at || person.created_at
  const end = person.custom?.first_broker_action_at
  if (typeof start !== 'string' || typeof end !== 'string') return null
  const a = Date.parse(start)
  const b = Date.parse(end)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null
  return Math.round((b - a) / 1000)
}
