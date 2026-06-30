import 'server-only'
import { createServiceClient } from '@/lib/data/client'

/**
 * Real, verifiable KPI counts for the FUB-style desktop dashboard. Only numbers
 * we can actually compute from our data — no fabricated analytics (the data-
 * accuracy mandate forbids made-up figures). "Avg contact attempts" / "speed to
 * action" are FUB analytics we don't track, so we don't show invented values.
 */
export type DashboardKpis = {
  newLeads30d: number
  unactioned: number
}

export async function getDashboardKpis(brokerSlug: string | null, unactioned: number): Promise<DashboardKpis> {
  const sb = createServiceClient()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  // Count GENUINE new leads: the `lead_created` timeline events in the window —
  // NOT crm_people.created_at, which reflects the bulk-import date and would
  // report the whole 18k book as "new leads".
  let q = sb
    .from('crm_timeline')
    .select('id, crm_people!inner(assigned_broker)', { count: 'exact', head: true })
    .eq('kind', 'lead_created')
    .gte('ts', since)
  if (brokerSlug) q = q.eq('crm_people.assigned_broker', brokerSlug)
  const { count } = await q
  return { newLeads30d: count ?? 0, unactioned }
}
