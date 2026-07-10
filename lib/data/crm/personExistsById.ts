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
  if (!Number.isInteger(personId) || personId <= 0) return false
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id')
    .eq('id', personId)
    .eq('deleted', false)
    .maybeSingle()
  if (error) {
    console.error('[personExistsById]', error.message)
    return false
  }
  return Boolean(data)
}
