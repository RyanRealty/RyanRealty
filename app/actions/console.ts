'use server'

import { listCrmPeople, getCrmAccess } from '@/app/actions/crm'
import { checkAdminAction } from '@/lib/admin/require-admin'

export type ConsoleLeadHit = { id: number; name: string; stage: string; source: string | null }

/**
 * Lead search for the console command palette (⌘K). Scoped to the caller's book
 * (broker sees own, superuser sees all) via the same access gate the list uses.
 */
export async function consoleSearchLeads(q: string): Promise<ConsoleLeadHit[]> {
  const query = q.trim()
  if (query.length < 2) return []
  const access = await getCrmAccess()
  if (!access) return []
  // The ⌘K palette renders for every admin role, but people.view is the CRM
  // read cap. Without this a report_viewer (null brokerSlug → no broker filter)
  // would search EVERY lead through the palette, bypassing the page guards
  // (audit MED — the one non-page CRM read path).
  const gate = await checkAdminAction('people.view')
  if (!gate.ok) return []
  const res = await listCrmPeople({ q: query, broker: access.brokerSlug ?? undefined, page: 1 })
  return res.rows.slice(0, 8).map((p) => ({
    id: p.id,
    name: p.name ?? `Contact #${p.id}`,
    stage: p.stage,
    source: p.source,
  }))
}
