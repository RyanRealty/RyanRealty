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

export interface ClosingDealRow {
  id: string
  propertyKey: string
  address: string
  city: string | null
  brokerName: string | null
  stage: string
  stageDetail: string | null
  cycleKind: string | null
  contractAcceptanceDate: string | null
  escrowClosingDate: string | null
  actualClosingDate: string | null
  salePrice: number | null
  listingPrice: number | null
  itemsTotal: number
  itemsInReview: number
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
  const cyclesRes = await sb
    .from('tc_cycles')
    .select(
      'id, deal_id, kind, contract_acceptance_date, escrow_closing_date, actual_closing_date, sale_price, listing_price, created_at',
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

  const counts = new Map<string, { total: number; inReview: number }>()
  for (const it of items ?? []) {
    const dealId = cycleToDeal.get(it.cycle_id as string)
    if (!dealId) continue
    const c = counts.get(dealId) ?? { total: 0, inReview: 0 }
    if (it.status !== 'optional') c.total++
    if (it.status === 'in_review') c.inReview++
    counts.set(dealId, c)
  }

  // Newest cycle wins the board row (a deal can re-cycle: listing → sale).
  const newestCycle = new Map<string, Row>()
  for (const c of cycles) {
    const dealId = c.deal_id as string
    const prev = newestCycle.get(dealId)
    if (!prev || String(c.created_at ?? '') > String(prev.created_at ?? '')) newestCycle.set(dealId, c)
  }

  const rows: ClosingDealRow[] = (deals as Row[]).map((d) => {
    const id = d.id as string
    const cy = newestCycle.get(id)
    const ct = counts.get(id) ?? { total: 0, inReview: 0 }
    return {
      id,
      propertyKey: String(d.property_key ?? ''),
      address: String(d.address ?? 'Unknown property'),
      city: (d.city as string | null) ?? null,
      brokerName: (d.broker_name as string | null) ?? null,
      stage: String(d.stage ?? 'closed'),
      stageDetail: (d.stage_detail as string | null) ?? null,
      cycleKind: (cy?.kind as string | null) ?? null,
      contractAcceptanceDate: (cy?.contract_acceptance_date as string | null) ?? null,
      escrowClosingDate: (cy?.escrow_closing_date as string | null) ?? null,
      actualClosingDate: (cy?.actual_closing_date as string | null) ?? null,
      salePrice: (cy?.sale_price as number | null) ?? null,
      listingPrice: (cy?.listing_price as number | null) ?? null,
      itemsTotal: ct.total,
      itemsInReview: ct.inReview,
    }
  })

  return { deals: rows, unreadable: false }
}
