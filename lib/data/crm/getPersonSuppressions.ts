/**
 * getPersonSuppressions -- read every crm_suppressions row for a person
 * (CONTACT360 Phase 8.1, used by the LDU decision in the CAPI route).
 *
 * Returns the raw suppression rows (channel + reason) so a PURE decision helper
 * (shouldExcludeFromSharing in lib/crm/gpc.ts) can decide whether the subject
 * must be sent to Meta in Limited Data Use mode. ANY suppression on ANY channel
 * means "do not share for ad targeting" -- the same conservative posture the
 * audience reader uses.
 *
 * DAL boundary (G1): the raw .from() read lives here, inside lib/data/. Service
 * role (the CAPI route has no user session). Never throws -- a read failure
 * returns [] so the caller decides on what it can see (the caller separately
 * defaults to LDU on its own consent signals; this read only ADDS exclusions).
 */

import { createServiceClient } from '@/lib/supabase/service'

export type PersonSuppressionRow = { channel: string; reason: string }

export async function getPersonSuppressions(personId: number): Promise<PersonSuppressionRow[]> {
  if (typeof personId !== 'number' || !Number.isFinite(personId)) return []
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_suppressions')
      .select('channel,reason')
      .eq('person_id', personId)
    if (error || !data) return []
    return data.map((r) => ({ channel: String(r.channel), reason: String(r.reason) }))
  } catch {
    return []
  }
}
