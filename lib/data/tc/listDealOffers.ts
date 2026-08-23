/**
 * Offer comparison reads for a Vault deal.
 * Raw .from() stays here (G1). Writes stay in app/actions/tc-offers.ts.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { DealOffer, OfferStatus } from '@/lib/tc/offers'

const OFFER_COLS =
  'id, deal_id, buyer_name, buyer_agent, price, earnest_money, financing_type, close_date, contingencies, status, submitted_at'

function mapOffer(r: Record<string, unknown>): DealOffer {
  return {
    id: String(r.id),
    dealId: String(r.deal_id),
    buyerName: String(r.buyer_name ?? ''),
    buyerAgent: (r.buyer_agent as string | null) ?? null,
    price: r.price == null ? null : Number(r.price),
    earnestMoney: r.earnest_money == null ? null : Number(r.earnest_money),
    financingType: (r.financing_type as string | null) ?? null,
    closeDate: r.close_date ? String(r.close_date).slice(0, 10) : null,
    contingencies: (r.contingencies as string | null) ?? null,
    status: r.status as OfferStatus,
    submittedAt: r.submitted_at ? String(r.submitted_at).slice(0, 10) : null,
  }
}

export async function listDealOffers(dealId: string): Promise<DealOffer[]> {
  const { data } = await createServiceClient()
    .from('tc_offers')
    .select(OFFER_COLS)
    .eq('deal_id', dealId)
    .order('created_at')
  return (data ?? []).map((r) => mapOffer(r as Record<string, unknown>))
}

export async function getDealOffer(dealId: string, offerId: string): Promise<DealOffer | null> {
  const { data } = await createServiceClient()
    .from('tc_offers')
    .select(OFFER_COLS)
    .eq('id', offerId)
    .eq('deal_id', dealId)
    .maybeSingle()
  return data ? mapOffer(data as Record<string, unknown>) : null
}

export type SaleCycleOfferTarget = {
  id: string
  buyers: unknown
}

export async function getLatestSaleCycle(dealId: string): Promise<SaleCycleOfferTarget | null> {
  const { data } = await createServiceClient()
    .from('tc_cycles')
    .select('id, buyers')
    .eq('deal_id', dealId)
    .eq('kind', 'sale')
    .order('created_at', { ascending: false })
    .limit(1)
  const row = data?.[0]
  if (!row) return null
  return { id: String(row.id), buyers: row.buyers }
}
