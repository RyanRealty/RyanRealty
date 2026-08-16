/**
 * Resolve the native crm_people.id already stitched to this browser's rr_vid.
 * Ads/CAPI use this so Meta's external_id is the same person the CRM audience
 * uploads — not a parallel cookie identity.
 */
import { createServiceClient } from '@/lib/supabase/service'

export async function getStitchedCrmPersonId(rrVid: string | null | undefined): Promise<number | null> {
  const vid = (rrVid ?? '').trim()
  if (!vid) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('visitor_identity_map')
    .select('crm_person_id')
    .eq('rr_vid', vid)
    .not('crm_person_id', 'is', null)
    .maybeSingle()
  if (error || data?.crm_person_id == null) return null
  const id = Number(data.crm_person_id)
  return Number.isInteger(id) && id > 0 ? id : null
}
