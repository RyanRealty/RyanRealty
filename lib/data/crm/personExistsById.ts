import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * True when a crm_people row with this native id exists and is not deleted.
 * Used by the identity bridge to validate a ?_pid= email-click param before
 * cookie-ing the browser to that person — a bad/stale id must never identify.
 *
 * DAL boundary (G1): the raw .from('crm_people') read lives here.
 */
export async function personExistsById(personId: number): Promise<boolean> {
  const state = await personExistenceById(personId)
  return state === 'exists'
}

/**
 * Tri-state variant for callers that must NOT fail closed on a transient read
 * error. The sendDeliverable chokepoint treats 'unknown' as pass-through: the
 * send engines below each resolve the person again and refuse on their own if
 * it is missing, so refusing here on a Supabase blip would block a legitimate
 * send with a misleading "not found".
 */
export async function personExistenceById(
  personId: number,
): Promise<'exists' | 'missing' | 'unknown'> {
  if (!Number.isInteger(personId) || personId <= 0) return 'missing'
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id')
    .eq('id', personId)
    .eq('deleted', false)
    .maybeSingle()
  if (error) {
    console.error('[personExistsById]', error.message)
    return 'unknown'
  }
  return data ? 'exists' : 'missing'
}
