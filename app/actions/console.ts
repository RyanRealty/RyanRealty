'use server'

/**
 * Console command-palette searches (⌘K).
 *
 * Intentionally does NOT import app/actions/crm.ts or getClosingsBoard.
 * Those NFT graphs (governed send → gmail → DAL barrel → TC pdfjs / mailbox
 * harvest) were landing inside every protected admin lambda via ConsoleShell
 * and blew admin/analytics/action-required past the 250mb uncompressed limit.
 */

import { getCrmAccess } from '@/app/actions/crm-access'
import { checkAdminAction, getAdminCapabilityContext } from '@/lib/admin/require-admin'
import { createServiceClient } from '@/lib/supabase/service'
import { scopeBroker } from '@/lib/crm/scope'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'

export type ConsoleLeadHit = { id: number; name: string; stage: string; source: string | null }

function escapeIlike(q: string): string {
  return q.replace(/[%_\\]/g, '\\$&')
}

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

  const scope = scopeBroker(access)
  const pattern = `%${escapeIlike(query)}%`
  const sb = createServiceClient()
  let req = sb
    .from('crm_people')
    .select('id,name,stage,source')
    .eq('deleted', false)
    .ilike('name', pattern)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(8)
  if (scope) req = req.eq('assigned_broker', scope)

  const { data, error } = await req
  if (error || !data) return []
  return data.map((p) => ({
    id: Number(p.id),
    name: (p.name as string | null) ?? `Contact #${p.id}`,
    stage: String(p.stage ?? ''),
    source: (p.source as string | null) ?? null,
  }))
}

export type ConsoleDealHit = { propertyKey: string; address: string; stage: string }

/**
 * Deal search for ⌘K — light tc_deals ilike only (no closings board / party
 * harvest / PDF stack). Same broker visibility rule as Closings.
 */
export async function consoleSearchDeals(q: string): Promise<ConsoleDealHit[]> {
  const query = q.trim()
  if (query.length < 2) return []
  const gate = await checkAdminAction('transactions.view')
  if (!gate.ok) return []
  const ctx = await getAdminCapabilityContext()
  if (!ctx) return []

  const pattern = `%${escapeIlike(query)}%`
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('tc_deals')
    .select('property_key, address, stage, broker_name')
    .ilike('address', pattern)
    .order('address', { ascending: true })
    .limit(24)
  if (error || !data) return []

  return data
    .filter((d) =>
      dealVisibleToBroker({
        role: ctx.role,
        brokerSlug: ctx.brokerSlug,
        dealBrokerName: (d.broker_name as string | null) ?? null,
      }),
    )
    .slice(0, 8)
    .map((d) => ({
      propertyKey: String(d.property_key ?? ''),
      address: String(d.address ?? ''),
      stage: String(d.stage ?? ''),
    }))
}
