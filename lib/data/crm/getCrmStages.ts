import 'server-only'
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'

/**
 * getCrmStages — the cached read side of the crm_stages config table.
 *
 * Replaces the hardcoded CRM_STAGES const (lib/crm/constants.ts) as the source
 * of pipeline stages for any READ surface. Returns the full set ordered by
 * funnel position (callers filter is_active themselves for pickers vs. counts —
 * a person on a deactivated stage still needs the label to render).
 *
 * DAL boundary (G1): the raw .from('crm_stages') read lives here, inside
 * lib/data/. Cached because stages change rarely; the mutation actions
 * (app/actions/crm-stages.ts) revalidate the affected pages on every change.
 *
 * Fails SOFT (empty array) on an unreadable table so a stage-driven surface
 * degrades to "no stages" rather than crashing.
 */
export type CrmStage = {
  key: string
  label: string
  position: number
  isActive: boolean
  isProtected: boolean
}

export const getCrmStages = unstable_cache(
  async (): Promise<CrmStage[]> => {
    const sb = supabaseAnon()
    if (!sb) return []
    const { data, error } = await sb
      .from('crm_stages')
      .select('key,label,position,is_active,is_protected')
      .order('position', { ascending: true })
      .order('key', { ascending: true })
    if (error || !data) {
      if (error) console.error('[getCrmStages]', error.message)
      return []
    }
    return (data as Array<{ key: string; label: string; position: number; is_active: boolean; is_protected: boolean }>).map(
      (r) => ({
        key: r.key,
        label: r.label,
        position: r.position,
        isActive: r.is_active,
        isProtected: r.is_protected,
      }),
    )
  },
  ['crm-stages-v1'],
  { revalidate: 300, tags: ['crm-stages'] },
)
