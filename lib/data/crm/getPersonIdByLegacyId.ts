import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Resolve a legacy person id (from the pre-cutover FUB migration,
 * crm_people.fub_legacy_id) to the canonical crm_people id.
 *
 * Renamed from getPersonIdByFubLegacyId.ts 2026-07-09. fub_legacy_id is kept
 * as a historical lineage column (Matt directive 2026-07-09) recording which
 * original FollowUpBoss record a person migrated from, not a live FUB
 * integration, this is a plain native lookup.
 *
 * Exists for the /admin/people/[legacyId] -> /admin/console/leads/[id]
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
