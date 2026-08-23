import 'server-only'

/**
 * Closings board read (P9 roll:remaining-families, IA lock 2026-08-05).
 *
 * The ONE deal list, rooted in TC truth (tc_deals — the P4 atlas finding:
 * /admin/deals read the retired skyslope_transactions mirror instead). Each
 * deal carries its newest cycle's dates/prices and its checklist posture so
 * the board can answer "what's in flight and what waits on a human" without
 * opening every deal. Fails LOUD into `unreadable` — never an all-clear zero.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getPartyNamesByDealIds } from './deal-people'

export interface ClosingDealRow {
  id: string
  propertyKey: string
  address: string
  city: string | null
  brokerName: string | null
  stage: string
  stageDetail: string | null
  cycleId: string | null
  cycleKind: string | null
  contractAcceptanceDate: string | null
  escrowClosingDate: string | null
  actualClosingDate: string | null
  salePrice: number | null
  listingPrice: number | null
  expirationDate: string | null
  mlsNumber: string | null
  escrowNumber: string | null
  itemsTotal: number
  itemsInReview: number
  itemsRequired: number
  partyNames: string[]
}

export type LiveDealCycle = {
  cycleId: string
  propertyKey: string
  address: string
  stage: string
}

const LIVE_STAGES = new Set(['pending', 'pre_contract', 'active_listing'])

/** In-flight deals a broker can compose a library form onto. */
export function liveDealCyclesFromBoard(deals: readonly ClosingDealRow[]): LiveDealCycle[] {
  return deals
    .filter((d) => d.cycleId && LIVE_STAGES.has(d.stage))
    .map((d) => ({
      cycleId: d.cycleId as string,
      propertyKey: d.propertyKey,
      address: d.address,
      stage: d.stage,
    }))
    .sort((a, b) => a.address.localeCompare(b.address))
}

export function closingSearchHaystack(d: ClosingDealRow): string {
  return [
    d.address,
    d.city ?? '',
    d.brokerName ?? '',
    d.mlsNumber ?? '',
    d.escrowNumber ?? '',
    d.propertyKey,
    ...d.partyNames,
  ]
    .join(' ')
    .toLowerCase()
}

export function closingMatchesQuery(d: ClosingDealRow, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return closingSearchHaystack(d).includes(needle)
}

/** SkySlope Incomplete Checklist: in-flight deals still holding required rows. */
export function incompleteInFlight(deals: readonly ClosingDealRow[]): ClosingDealRow[] {
  return deals
    .filter((d) => LIVE_STAGES.has(d.stage) && d.itemsRequired > 0)
    .sort((a, b) => b.itemsRequired - a.itemsRequired || a.address.localeCompare(b.address))
}

function asNameList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x ?? '').trim()).filter(Boolean)
}

function newestCycle(cycles: readonly Row[], dealId: string, stage: string): Row | undefined {
  const prefer = stage === 'active_listing' ? 'listing' : stage === 'pending' || stage === 'pre_contract' ? 'sale' : null
  const mine = cycles.filter((c) => c.deal_id === dealId)
  const pool = prefer ? mine.filter((c) => c.kind === prefer) : mine
  const use = pool.length ? pool : mine
  let best: Row | undefined
  for (const c of use) {
    if (!best || String(c.created_at ?? '') > String(best.created_at ?? '')) best = c
  }
  return best
}

export interface ClosingsBoard {
  deals: ClosingDealRow[]
  unreadable: boolean
}

type Row = Record<string, unknown>

export async function getClosingsBoard(): Promise<ClosingsBoard> {
  const sb = createServiceClient()
  const { data: deals, error: dealsErr } = await sb
    .from('tc_deals')
    .select('id, property_key, address, city, broker_name, stage, stage_detail')
  if (dealsErr) {
    console.error('[closings] tc_deals read failed:', dealsErr.message)
    return { deals: [], unreadable: true }
  }
  if (!deals?.length) return { deals: [], unreadable: false }

  const dealIds = deals.map((d) => d.id as string)
  const namesByDeal = await getPartyNamesByDealIds(dealIds)
  const cyclesRes = await sb
    .from('tc_cycles')
    .select(
      'id, deal_id, kind, contract_acceptance_date, escrow_closing_date, actual_closing_date, sale_price, listing_price, expiration_date, created_at, mls_number, escrow_number, buyers, sellers',
    )
    .in('deal_id', dealIds)
  if (cyclesRes.error) {
    console.error('[closings] tc_cycles read failed:', cyclesRes.error.message)
    return { deals: [], unreadable: true }
  }

  const cycles = (cyclesRes.data ?? []) as Row[]
  const cycleToDeal = new Map(cycles.map((c) => [c.id as string, c.deal_id as string]))
  const { data: items, error: itemsErr } = await sb
    .from('tc_checklist_items')
    .select('cycle_id, status')
    .in('cycle_id', [...cycleToDeal.keys()])
  if (itemsErr) {
    console.error('[closings] tc_checklist_items read failed:', itemsErr.message)
    return { deals: [], unreadable: true }
  }

  const counts = new Map<string, { total: number; inReview: number; required: number }>()
  for (const it of items ?? []) {
    const cycleId = String(it.cycle_id)
    const c = counts.get(cycleId) ?? { total: 0, inReview: 0, required: 0 }
    if (it.status !== 'optional') c.total++
    if (it.status === 'in_review') c.inReview++
    if (it.status === 'required') c.required++
    counts.set(cycleId, c)
  }

  const rows: ClosingDealRow[] = (deals as Row[]).map((d) => {
    const id = d.id as string
    const stage = String(d.stage ?? 'closed')
    const cy = newestCycle(cycles, id, stage)
    const ct = (cy?.id ? counts.get(String(cy.id)) : null) ?? { total: 0, inReview: 0, required: 0 }
    const linked = namesByDeal.get(id) ?? []
    const cycleParties = [...asNameList(cy?.sellers), ...asNameList(cy?.buyers)]
    return {
      id,
      propertyKey: String(d.property_key ?? ''),
      address: String(d.address ?? 'Unknown property'),
      city: (d.city as string | null) ?? null,
      brokerName: (d.broker_name as string | null) ?? null,
      stage,
      stageDetail: (d.stage_detail as string | null) ?? null,
      cycleId: cy?.id ? String(cy.id) : null,
      cycleKind: (cy?.kind as string | null) ?? null,
      contractAcceptanceDate: (cy?.contract_acceptance_date as string | null) ?? null,
      escrowClosingDate: (cy?.escrow_closing_date as string | null) ?? null,
      actualClosingDate: (cy?.actual_closing_date as string | null) ?? null,
      salePrice: (cy?.sale_price as number | null) ?? null,
      listingPrice: (cy?.listing_price as number | null) ?? null,
      expirationDate: (cy?.expiration_date as string | null) ?? null,
      mlsNumber: (cy?.mls_number as string | null) ?? null,
      escrowNumber: (cy?.escrow_number as string | null) ?? null,
      itemsTotal: ct.total,
      itemsInReview: ct.inReview,
      itemsRequired: ct.required,
      partyNames: linked.length ? linked : cycleParties,
    }
  })

  return { deals: rows, unreadable: false }
}

export async function getLiveDealCycles(): Promise<LiveDealCycle[]> {
  const board = await getClosingsBoard()
  if (board.unreadable) return []
  return liveDealCyclesFromBoard(board.deals)
}
