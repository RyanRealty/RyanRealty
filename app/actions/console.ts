'use server'

import { listCrmPeople, getCrmAccess } from '@/app/actions/crm'

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
  const res = await listCrmPeople({ q: query, broker: access.brokerSlug ?? undefined, page: 1 })
  return res.rows.slice(0, 8).map((p) => ({
    id: p.id,
    name: p.name ?? `Contact #${p.id}`,
    stage: p.stage,
    source: p.source,
  }))
}
