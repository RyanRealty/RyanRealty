'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getAdminCapabilityContext } from '@/lib/admin/require-admin'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { OFFER_STATUSES, type OfferStatus } from '@/lib/tc/offers'
import { acceptListingContract } from '@/app/actions/tc-listings'
import { syncDealCalendar } from '@/lib/tc/deal-calendar'
import { getDealById } from '@/lib/data/tc/listing-action-reads'
import { getDealOffer, getLatestSaleCycle } from '@/lib/data/tc/listDealOffers'

function getServiceSupabase() {
  return createServiceClient()
}

async function requireDeal(dealId: string) {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { error: 'Not authorized' as const }
  }
  const deal = await getDealById(dealId)
  if (!deal) return { error: 'Deal not found' as const }
  const ctx = await getAdminCapabilityContext()
  if (
    !ctx ||
    !dealVisibleToBroker({
      role: ctx.role,
      brokerSlug: ctx.brokerSlug,
      dealBrokerName: deal.broker_name,
    })
  ) {
    return { error: 'Not authorized' as const }
  }
  return { supabase: getServiceSupabase(), deal, email }
}

export async function saveDealOffer(input: {
  id?: string
  dealId: string
  buyerName: string
  buyerAgent?: string
  price?: number | null
  earnestMoney?: number | null
  financingType?: string | null
  closeDate?: string | null
  contingencies?: string | null
  status?: OfferStatus
  submittedAt?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDeal(input.dealId)
  if ('error' in auth) return { ok: false, error: auth.error }
  const name = input.buyerName.trim()
  if (!name) return { ok: false, error: 'Buyer name is required.' }
  const status = input.status && (OFFER_STATUSES as readonly string[]).includes(input.status) ? input.status : 'received'
  const row = {
    deal_id: input.dealId,
    buyer_name: name,
    buyer_agent: input.buyerAgent?.trim() || null,
    price: input.price ?? null,
    earnest_money: input.earnestMoney ?? null,
    financing_type: input.financingType || null,
    close_date: input.closeDate || null,
    contingencies: input.contingencies?.trim() || null,
    status,
    submitted_at: input.submittedAt || null,
    updated_at: new Date().toISOString(),
  }
  const { supabase, email, deal } = auth
  if (input.id) {
    const { error } = await supabase.from('tc_offers').update(row).eq('id', input.id).eq('deal_id', input.dealId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from('tc_offers').insert(row)
    if (error) return { ok: false, error: error.message }
  }
  await supabase.from('tc_events').insert({
    deal_id: input.dealId,
    actor: email,
    action: input.id ? 'offer_updated' : 'offer_received',
    detail: { buyer: name, price: input.price, status },
  })
  revalidatePath(`/admin/deals/${deal.property_key}`)
  return { ok: true }
}

export async function acceptDealOffer(
  dealId: string,
  offerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDeal(dealId)
  if ('error' in auth) return { ok: false, error: auth.error }
  const { supabase, deal, email } = auth
  const offer = await getDealOffer(dealId, offerId)
  if (!offer) return { ok: false, error: 'Offer not found' }

  if (deal.stage === 'active_listing') {
    const acc = await acceptListingContract(deal.property_key)
    if (!acc.ok) return acc
  }

  await supabase.from('tc_offers').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('deal_id', dealId).neq('id', offerId)
  await supabase.from('tc_offers').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', offerId)

  const sale = await getLatestSaleCycle(dealId)
  if (sale) {
    const buyers = Array.isArray(sale.buyers) && sale.buyers.length ? sale.buyers : [offer.buyerName]
    await supabase
      .from('tc_cycles')
      .update({
        sale_price: offer.price,
        escrow_closing_date: offer.closeDate,
        earnest_money: offer.earnestMoney != null ? { amount: offer.earnestMoney } : null,
        buyers,
      })
      .eq('id', sale.id)
  }

  await supabase.from('tc_events').insert({
    deal_id: dealId,
    actor: email,
    action: 'offer_accepted',
    detail: { offerId, buyer: offer.buyerName, price: offer.price },
  })
  await syncDealCalendar(dealId)
  revalidatePath('/admin/closings')
  revalidatePath(`/admin/deals/${deal.property_key}`)
  return { ok: true }
}
