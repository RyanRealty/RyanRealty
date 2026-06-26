import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmReportAreas — the cached read side of the crm_report_areas config table.
 *
 * Replaces the hardcoded market-report area set (buildMarketReportAreas in
 * lib/data/crm/getContactReportSubscriptions.ts: Central Oregon cities + resort
 * communities from data/resort-communities.json) as the source of selectable
 * market-report areas for any READ surface (the record-card
 * ReportSubscriptionsPanel area picker). Returns the full set ordered by picker
 * position (callers filter is_active themselves for the picker vs. resolving a
 * stored subscription slug, which still needs the label even on a deactivated
 * area).
 *
 * DAL boundary (G1): the raw .from('crm_report_areas') read lives here, inside
 * lib/data/. Cached because areas change rarely; the mutation actions
 * (app/actions/crm-report-areas.ts) revalidate the affected pages on every change.
 *
 * Fails SOFT (empty array) on an unreadable table so an area-driven surface
 * degrades to "no areas" rather than crashing. The record-card keeps the
 * hardcoded buildMarketReportAreas() list as its fallback during migration.
 */
export type CrmReportArea = {
  key: string
  label: string
  position: number
  isActive: boolean
  isProtected: boolean
}

export const getCrmReportAreas = unstable_cache(
  async (): Promise<CrmReportArea[]> => {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('crm_report_areas')
      .select('key,label,position,is_active,is_protected')
      .order('position', { ascending: true })
      .order('key', { ascending: true })
    if (error || !data) {
      if (error) console.error('[getCrmReportAreas]', error.message)
      return []
    }
    return (
      data as Array<{ key: string; label: string; position: number; is_active: boolean; is_protected: boolean }>
    ).map((r) => ({
      key: r.key,
      label: r.label,
      position: r.position,
      isActive: r.is_active,
      isProtected: r.is_protected,
    }))
  },
  ['crm-report-areas-v1'],
  { revalidate: 300, tags: ['crm-report-areas'] },
)
