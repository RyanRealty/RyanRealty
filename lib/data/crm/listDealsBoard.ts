import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { dealInScope } from '@/lib/crm/deal-scope'
import type { CrmBrokerSlug } from '@/lib/crm/constants'

/**
 * listDealsBoard — the Deals Kanban's row reader (spec §10 §5–§8 + §13 filters).
 *
 * Returns every deal the caller may see, shaped for the board: card fields
 * (price, stored commission, close date, address) + the §8 Row-4 avatar cluster
 * inputs (ALL linked contacts via the crm_deal_people junction, agent slug).
 *
 * Broker scope is enforced HERE, at the data layer (mission constraint):
 * a restricted broker gets only deals where the deal's own assigned_broker OR
 * its linked person's assigned_broker is theirs (dealInScope — the same pure
 * rule the mutation guard uses). A superuser (scoped=null) sees everything.
 *
 * §13 filters, applied server-side:
 *  - status: 'current' (active/null) · 'archived' · 'all' (any non-deleted)
 *  - agent:  deals whose assigned_broker matches (superuser's "Everyone ▾")
 *
 * Uncached by design: the board is a force-dynamic admin surface over a small
 * table (~tens of rows) and drag-to-restage must read back its own write.
 * DAL boundary (G1): the raw .from() lives here, inside lib/data/.
 */

export type DealBoardStatusFilter = 'current' | 'archived' | 'all'

export type DealBoardPerson = { id: number; name: string | null }

export type DealBoardRow = {
  id: number
  name: string | null
  pipeline: string | null
  stage: string | null
  value: number | null
  status: string | null
  entered_stage_at: string | null
  /** Gross commission — a STORED amount, never computed from price (spec §8). */
  commission_dollars: number | null
  /** Projected close date (doubles as FUB's only close date; §20.10). */
  close_date: string | null
  /** In-house actual close date — set when the deal enters a closed stage. */
  actual_close_date: string | null
  property_address: string | null
  assigned_broker: string | null
  person_id: number | null
  /** ALL linked contacts (crm_deal_people junction) — the card's initials cluster. */
  people: DealBoardPerson[]
}

type RawRow = Record<string, unknown> & {
  crm_people: { name: string | null; assigned_broker: string | null } | null
  people:
    | Array<{ person_id: number; person: { id: number; name: string | null } | { id: number; name: string | null }[] | null }>
    | null
}

function normalizeStatus(s: string | null): 'active' | 'archived' | 'deleted' | 'other' {
  const v = (s ?? 'active').trim().toLowerCase()
  if (v === '' || v === 'active') return 'active'
  if (v === 'archived') return 'archived'
  if (v === 'deleted') return 'deleted'
  return 'other'
}

export async function listDealsBoard(
  scoped: CrmBrokerSlug | null,
  opts: { status?: DealBoardStatusFilter; agent?: string | null } = {},
): Promise<DealBoardRow[]> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_deals')
    .select(
      'id,name,pipeline,stage,value,status,entered_stage_at,commission_dollars,close_date,actual_close_date,' +
        'property_address,assigned_broker,person_id,' +
        'crm_people(name,assigned_broker),' +
        'people:crm_deal_people(person_id,person:crm_people(id,name))',
    )
    .order('entered_stage_at', { ascending: false })

  const statusFilter = opts.status ?? 'current'
  const agent = opts.agent?.trim() || null

  const rows: DealBoardRow[] = []
  for (const r of (data ?? []) as unknown as RawRow[]) {
    const status = normalizeStatus(r.status as string | null)
    if (status === 'deleted') continue
    if (statusFilter === 'current' && status !== 'active') continue
    if (statusFilter === 'archived' && status !== 'archived') continue

    const dealBroker = (r.assigned_broker as string | null) ?? null
    const personBroker = r.crm_people?.assigned_broker ?? null
    // Data-layer scope: a restricted broker only ever receives their own deals.
    if (!dealInScope(scoped, dealBroker, personBroker)) continue
    // Superuser agent filter (§13 "Everyone ▾") — a restricted broker's scope
    // already pins the set, so the filter only narrows further.
    if (agent && dealBroker !== agent) continue

    const junction = Array.isArray(r.people) ? r.people : []
    const people: DealBoardPerson[] = []
    for (const j of junction) {
      const p = Array.isArray(j.person) ? (j.person[0] ?? null) : j.person
      if (p) people.push({ id: Number(p.id), name: p.name ?? null })
    }
    // Legacy single-link fallback: a deal with person_id but no junction row
    // still shows its contact.
    if (people.length === 0 && r.person_id != null && r.crm_people) {
      people.push({ id: Number(r.person_id), name: r.crm_people.name ?? null })
    }

    rows.push({
      id: Number(r.id),
      name: (r.name as string | null) ?? null,
      pipeline: (r.pipeline as string | null) ?? null,
      stage: (r.stage as string | null) ?? null,
      value: r.value == null ? null : Number(r.value),
      status,
      entered_stage_at: (r.entered_stage_at as string | null) ?? null,
      commission_dollars: r.commission_dollars == null ? null : Number(r.commission_dollars),
      close_date: (r.close_date as string | null) ?? null,
      actual_close_date: (r.actual_close_date as string | null) ?? null,
      property_address: (r.property_address as string | null) ?? null,
      assigned_broker: dealBroker,
      person_id: r.person_id == null ? null : Number(r.person_id),
      people,
    })
  }
  return rows
}
