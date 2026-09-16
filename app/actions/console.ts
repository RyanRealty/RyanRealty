'use server'

import { getCrmAccess } from '@/lib/data/crm/getCrmAccess'
import { searchCrmPeople } from '@/lib/data/crm/searchCrmPeople'
import { scopeBroker } from '@/lib/crm/scope'
import { checkAdminAction, getAdminCapabilityContext } from '@/lib/admin/require-admin'
import { closingMatchesQuery, getClosingsBoard } from '@/lib/data/tc/closings'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'

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
  // scopeBroker(superuser) is null = every book. Restricted brokers get their
  // own slug; unmapped non-superusers get UNMAPPED_OWN_BOOK (empty). Do not
  // fall back to access.brokerSlug — that would clamp Matt to the 'matt' book
  // and contradict "superuser sees all" above.
  const hits = await searchCrmPeople({
    q: query,
    brokerScope: scopeBroker(access),
    limit: 8,
  })
  return hits.map((p) => ({
    id: p.id,
    name: p.name ?? `Contact #${p.id}`,
    stage: p.stage ?? '',
    source: p.source,
  }))
}

export type ConsoleDealHit = { propertyKey: string; address: string; stage: string }

/** Deal search for ⌘K. Same matcher as Closings; scoped to the caller's files. */
export async function consoleSearchDeals(q: string): Promise<ConsoleDealHit[]> {
  const query = q.trim()
  if (query.length < 2) return []
  const gate = await checkAdminAction('transactions.view')
  if (!gate.ok) return []
  const ctx = await getAdminCapabilityContext()
  if (!ctx) return []
  const board = await getClosingsBoard()
  return board.deals
    .filter((d) =>
      dealVisibleToBroker({
        role: ctx.role,
        brokerSlug: ctx.brokerSlug,
        dealBrokerName: d.brokerName,
      }),
    )
    .filter((d) => closingMatchesQuery(d, query))
    .slice(0, 8)
    .map((d) => ({ propertyKey: d.propertyKey, address: d.address, stage: d.stage }))
}
