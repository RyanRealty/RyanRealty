/**
 * getDealScopeRow — the scope identity of a deal for the deal-mutation auth guard,
 * plus the live stage context a restage needs.
 *
 * Returns the deal's own `assigned_broker` and its linked person's
 * `assigned_broker` (the scope inputs) AND the deal's current `stage`, `pipeline`,
 * linked `personId`, and `name` (used by the drag-to-restage action for the no-op
 * check, pipeline-stage validation, and the timeline audit from→to). Intentionally
 * **uncached**: an authorization check — and a restage's current-stage read — must
 * reflect the live row the instant a deal or its person changes, so it reads fresh
 * every call (unlike the cached deal-detail reader). The raw .from() lives here,
 * inside lib/data/, per the DAL boundary (G1).
 */
import { createServiceClient } from '@/lib/data/client'

export type DealScopeRow = {
  assignedBroker: string | null
  personBroker: string | null
  stage: string | null
  pipeline: string | null
  personId: number | null
  name: string | null
}

export async function getDealScopeRow(dealId: number): Promise<DealScopeRow | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_deals')
    .select('assigned_broker,stage,pipeline,person_id,name,crm_people(assigned_broker)')
    .eq('id', dealId)
    .maybeSingle()
  if (!data) return null
  // A to-one embed types as an array under the generated client; normalize both.
  const cp = (data as unknown as { crm_people: { assigned_broker: string | null } | { assigned_broker: string | null }[] | null }).crm_people
  const personRow = Array.isArray(cp) ? (cp[0] ?? null) : cp
  const d = data as {
    assigned_broker: string | null
    stage: string | null
    pipeline: string | null
    person_id: number | null
    name: string | null
  }
  return {
    assignedBroker: d.assigned_broker ?? null,
    personBroker: personRow?.assigned_broker ?? null,
    stage: d.stage ?? null,
    pipeline: d.pipeline ?? null,
    personId: d.person_id ?? null,
    name: d.name ?? null,
  }
}
