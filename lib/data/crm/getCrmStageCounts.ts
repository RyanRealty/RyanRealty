import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { buildCrmPeopleQuery } from '@/lib/data/crm/buildCrmPeopleQuery'
import { getCrmStages } from '@/lib/data/crm/getCrmStages'
import { scopeBroker, type ScopeAccess } from '@/lib/crm/scope'

/**
 * getCrmStageCounts — the live per-stage contact count for the Stages strip, under
 * the caller's broker scope, resolved through the ONE compiler (buildCrmPeopleQuery,
 * countOnly) so the number equals exactly what filtering by ?stage= will show. Only
 * the ACTIVE stages are returned, in config order.
 *
 * NOT cached: the count is per-caller (broker scope) and live against crm_people, so
 * an unstable_cache keyed without the scope would leak one broker's count to another.
 * The set is tiny (≤ ~8 active stages) so an uncached read is cheap.
 *
 * DAL boundary (G1): the scoped counts run through buildCrmPeopleQuery here, inside lib/data/.
 */
export type CrmStageCount = { key: string; label: string; count: number }

export async function getCrmStageCounts(access: ScopeAccess): Promise<CrmStageCount[]> {
  const sb = createServiceClient()
  const brokerScope = scopeBroker(access)
  const stages = (await getCrmStages()).filter((s) => s.isActive)

  return Promise.all(
    stages.map(async (s): Promise<CrmStageCount> => {
      const { query } = buildCrmPeopleQuery(
        sb,
        { type: 'group', op: 'and', nodes: [{ field: 'stage', value: s.key }] },
        brokerScope,
        { countOnly: true },
      )
      const { count } = await query
      return { key: s.key, label: s.label, count: count ?? 0 }
    }),
  )
}
