import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Resolve a legacy person id (from the pre-cutover CRM migration,
 * crm_people.fub_legacy_id) to the canonical crm_people id.
 *
 * fub_legacy_id is a historical lineage column recording which imported
 * record a person migrated from. This is a plain native lookup.
 *
 * Exists for the /admin/people/[legacyId] -> /admin/crm/[id]
 * redirect (admin consolidation 2026-07-07: the standalone people index merged
 * into the person page). Old links and bookmarks keep working through this
 * lookup.
 */
export async function getPersonIdByLegacyId(legacyId: number): Promise<number | null> {
  if (!Number.isInteger(legacyId) || legacyId <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id')
    .eq('fub_legacy_id', legacyId)
    .eq('deleted', false)
    .maybeSingle()
  if (error) {
    console.error('[getPersonIdByLegacyId]', error.message)
    return null
  }
  return (data as { id: number } | null)?.id ?? null
}
