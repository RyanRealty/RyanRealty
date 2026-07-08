import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Resolve a FUB legacy person id to the canonical crm_people id.
 *
 * Exists for the /admin/people/[fubPersonId] → /admin/console/leads/[id]
 * redirect (admin consolidation 2026-07-07: the standalone people index merged
 * into the person page). Old links and bookmarks keep working through this
 * lookup.
 */
export async function getPersonIdByFubLegacyId(fubLegacyId: number): Promise<number | null> {
  if (!Number.isInteger(fubLegacyId) || fubLegacyId <= 0) return null
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_people')
    .select('id')
    .eq('fub_legacy_id', fubLegacyId)
    .eq('deleted', false)
    .maybeSingle()
  if (error) {
    console.error('[getPersonIdByFubLegacyId]', error.message)
    return null
  }
  return (data as { id: number } | null)?.id ?? null
}
