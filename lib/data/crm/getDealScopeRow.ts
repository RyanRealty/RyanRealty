/**
 * getDealScopeRow — the scope identity of a deal for the deal-mutation auth guard.
 *
 * Returns the deal's own `assigned_broker` and its linked person's
 * `assigned_broker`. Intentionally **uncached**: an authorization check must
 * reflect the live owner the instant a deal or its person is reassigned, so it
 * reads fresh every call (unlike the cached deal-detail reader). The raw .from()
 * lives here, inside lib/data/, per the DAL boundary (G1).
 */
import { createServiceClient } from '@/lib/data/client'

export type DealScopeRow = { assignedBroker: string | null; personBroker: string | null }

export async function getDealScopeRow(dealId: number): Promise<DealScopeRow | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_deals')
    .select('assigned_broker,crm_people(assigned_broker)')
    .eq('id', dealId)
    .maybeSingle()
  if (!data) return null
  // A to-one embed types as an array under the generated client; normalize both.
  const cp = (data as unknown as { crm_people: { assigned_broker: string | null } | { assigned_broker: string | null }[] | null }).crm_people
  const personRow = Array.isArray(cp) ? (cp[0] ?? null) : cp
  return {
    assignedBroker: (data as { assigned_broker: string | null }).assigned_broker ?? null,
    personBroker: personRow?.assigned_broker ?? null,
  }
}
