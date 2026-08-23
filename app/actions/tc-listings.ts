'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { getAdminCapabilityContext } from '@/lib/admin/require-admin'
import { dealVisibleToBroker } from '@/lib/tc/deal-scope'
import { nextDuplicatePropertyKey, todayIsoDate } from '@/lib/tc/listing-actions'
import { EMPTY_PROPERTY_FACTS, brokerRoleFromDealParties, seedChecklistItems } from '@/lib/tc/required-documents'
import { getDealParties } from '@/lib/data/tc/deal-people'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function requireDeal(propertyKey: string) {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role || (role.role !== 'superuser' && role.role !== 'broker')) {
    return { error: 'Not authorized' as const }
  }
  const supabase = getServiceSupabase()
  const { data: deal } = await supabase.from('tc_deals').select('*').eq('property_key', propertyKey).maybeSingle()
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
  return { supabase, deal, email }
}

function revalidateDeal(key: string) {
  revalidatePath('/admin/closings')
  revalidatePath(`/admin/deals/${key}`)
}

/** Listing kebab Accept Contract: same file, new sale cycle, stage pending. Not Offers. */
export async function acceptListingContract(
  propertyKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireDeal(propertyKey)
  if ('error' in auth) return { ok: false, error: auth.error }
  const { supabase, deal, email } = auth
  if (deal.stage !== 'active_listing') return { ok: false, error: 'Only an active listing can accept a contract.' }

  const { data: cycles } = await supabase
    .from('tc_cycles')
    .select('*')
    .eq('deal_id', deal.id)
    .eq('kind', 'listing')
    .order('created_at', { ascending: false })
    .limit(1)
  const listing = cycles?.[0]
  const cycleId = crypto.randomUUID()
  const { error: cycleErr } = await supabase.from('tc_cycles').insert({
    id: cycleId,
    deal_id: deal.id,
    kind: 'sale',
    source: 'inhouse',
    source_guid: `inhouse:${cycleId}`,
    status: 'Pending',
    mls_number: listing?.mls_number ?? null,
    sellers: listing?.sellers ?? [],
    buyers: listing?.buyers ?? [],
    listing_price: listing?.listing_price ?? null,
    broker_name: deal.broker_name,
    contract_acceptance_date: todayIsoDate(),
    checklist_type: listing?.checklist_type ?? null,
  })
  if (cycleErr) return { ok: false, error: cycleErr.message }

  const parties = await getDealParties(deal.id)
  const role = brokerRoleFromDealParties(parties.map((p) => p.role))
  const checklist = seedChecklistItems(role === 'unknown' ? 'listing' : role, EMPTY_PROPERTY_FACTS)
  if (checklist.length) {
    await supabase.from('tc_checklist_items').insert(
      checklist.map((row) => ({
        cycle_id: cycleId,
        name: row.name,
        type_name: row.type_name,
        status: row.status,
        sort_order: row.sort_order,
      })),
    )
  }

  const { error: upErr } = await supabase
    .from('tc_deals')
    .update({ stage: 'pending', stage_detail: 'Accepted contract' })
    .eq('id', deal.id)
  if (upErr) return { ok: false, error: upErr.message }

  await supabase.from('tc_events').insert({
    deal_id: deal.id,
    cycle_id: cycleId,
    actor: email,
    action: 'listing_contract_accepted',
    detail: { from: 'active_listing', to: 'pending' },
  })
  revalidateDeal(propertyKey)
  return { ok: true }
}

/** Listing kebab Duplicate: new file, listing cycle + people + contacts + checklist. No docs. */
export async function duplicateListing(
  propertyKey: string,
): Promise<{ ok: boolean; error?: string; propertyKey?: string }> {
  const auth = await requireDeal(propertyKey)
  if ('error' in auth) return { ok: false, error: auth.error }
  const { supabase, deal, email } = auth
  if (deal.stage !== 'active_listing' && deal.stage !== 'dead') {
    return { ok: false, error: 'Duplicate a listing file, not a closing.' }
  }

  const { data: keys } = await supabase.from('tc_deals').select('property_key')
  const newKey = nextDuplicatePropertyKey(
    (keys ?? []).map((r) => String(r.property_key)),
    deal.property_key,
  )
  const newDealId = crypto.randomUUID()
  const { error: dealErr } = await supabase.from('tc_deals').insert({
    id: newDealId,
    property_key: newKey,
    address: deal.address,
    city: deal.city,
    state: deal.state ?? 'OR',
    broker_name: deal.broker_name,
    stage: 'active_listing',
    stage_detail: 'Duplicated listing',
  })
  if (dealErr) return { ok: false, error: dealErr.message }

  const { data: listingCycles } = await supabase
    .from('tc_cycles')
    .select('*')
    .eq('deal_id', deal.id)
    .eq('kind', 'listing')
    .order('created_at', { ascending: false })
    .limit(1)
  const listing = listingCycles?.[0]
  const newCycleId = crypto.randomUUID()
  if (listing) {
    const { error: cycleErr } = await supabase.from('tc_cycles').insert({
      id: newCycleId,
      deal_id: newDealId,
      kind: 'listing',
      source: 'inhouse',
      source_guid: `inhouse:${newCycleId}`,
      status: listing.status ?? 'Active',
      mls_number: listing.mls_number,
      sellers: listing.sellers ?? [],
      buyers: listing.buyers ?? [],
      listing_price: listing.listing_price,
      listing_date: listing.listing_date,
      expiration_date: listing.expiration_date,
      checklist_type: listing.checklist_type,
      broker_name: deal.broker_name,
    })
    if (cycleErr) {
      await supabase.from('tc_deals').delete().eq('id', newDealId)
      return { ok: false, error: cycleErr.message }
    }
    const { data: items } = await supabase
      .from('tc_checklist_items')
      .select('name, type_name, status, sort_order')
      .eq('cycle_id', listing.id)
    if (items?.length) {
      await supabase.from('tc_checklist_items').insert(
        items.map((it) => ({
          cycle_id: newCycleId,
          name: it.name,
          type_name: it.type_name,
          status: it.status === 'optional' || it.status === 'na' ? it.status : 'required',
          sort_order: it.sort_order,
        })),
      )
    }
  }

  const { data: people } = await supabase.from('tc_deal_people').select('person_id, role').eq('deal_id', deal.id)
  if (people?.length) {
    await supabase.from('tc_deal_people').insert(
      people.map((p) => ({ deal_id: newDealId, person_id: p.person_id, role: p.role })),
    )
  }
  const { data: contacts } = await supabase
    .from('tc_deal_contacts')
    .select('role, name, company, email, phone, notes')
    .eq('deal_id', deal.id)
  if (contacts?.length) {
    await supabase.from('tc_deal_contacts').insert(
      contacts.map((c) => ({
        deal_id: newDealId,
        role: c.role,
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        notes: c.notes,
        source: 'duplicated',
      })),
    )
  }

  await supabase.from('tc_events').insert({
    deal_id: newDealId,
    actor: email,
    action: 'listing_duplicated',
    detail: { from: propertyKey, to: newKey },
  })
  revalidateDeal(propertyKey)
  revalidateDeal(newKey)
  return { ok: true, propertyKey: newKey }
}

/** Listing kebab Merge: other file's cycles/people/contacts land on this deal; other is dead. */
export async function mergeListingInto(
  keepKey: string,
  otherKey: string,
): Promise<{ ok: boolean; error?: string }> {
  if (keepKey === otherKey) return { ok: false, error: 'Pick a different listing to merge in.' }
  const auth = await requireDeal(keepKey)
  if ('error' in auth) return { ok: false, error: auth.error }
  const otherAuth = await requireDeal(otherKey)
  if ('error' in otherAuth) return { ok: false, error: otherAuth.error }
  const { supabase, deal: keep, email } = auth
  const other = otherAuth.deal
  if (keep.stage !== 'active_listing' && keep.stage !== 'pending') {
    return { ok: false, error: 'Merge into an active listing or a pending file.' }
  }
  if (other.stage === 'closed') return { ok: false, error: 'Do not merge a closed file into this one.' }

  const { error: moveErr } = await supabase.from('tc_cycles').update({ deal_id: keep.id }).eq('deal_id', other.id)
  if (moveErr) return { ok: false, error: moveErr.message }

  const { data: keepPeople } = await supabase.from('tc_deal_people').select('person_id').eq('deal_id', keep.id)
  const have = new Set((keepPeople ?? []).map((p) => Number(p.person_id)))
  const { data: otherPeople } = await supabase.from('tc_deal_people').select('person_id, role').eq('deal_id', other.id)
  const addPeople = (otherPeople ?? []).filter((p) => !have.has(Number(p.person_id)))
  if (addPeople.length) {
    await supabase.from('tc_deal_people').insert(
      addPeople.map((p) => ({ deal_id: keep.id, person_id: p.person_id, role: p.role })),
    )
  }

  const { data: keepContacts } = await supabase
    .from('tc_deal_contacts')
    .select('role, name, email')
    .eq('deal_id', keep.id)
  const contactHave = new Set(
    (keepContacts ?? []).map((c) => `${c.role}|${(c.email ?? '').toLowerCase()}|${(c.name ?? '').toLowerCase()}`),
  )
  const { data: otherContacts } = await supabase
    .from('tc_deal_contacts')
    .select('role, name, company, email, phone, notes')
    .eq('deal_id', other.id)
  const addContacts = (otherContacts ?? []).filter((c) => {
    const key = `${c.role}|${(c.email ?? '').toLowerCase()}|${(c.name ?? '').toLowerCase()}`
    return !contactHave.has(key)
  })
  if (addContacts.length) {
    await supabase.from('tc_deal_contacts').insert(
      addContacts.map((c) => ({
        deal_id: keep.id,
        role: c.role,
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        notes: c.notes,
        source: 'merged',
      })),
    )
  }

  await supabase
    .from('tc_deals')
    .update({ stage: 'dead', stage_detail: `Merged into ${keep.address}` })
    .eq('id', other.id)

  await supabase.from('tc_events').insert([
    {
      deal_id: keep.id,
      actor: email,
      action: 'listing_merged',
      detail: { absorbed: otherKey, absorbedAddress: other.address },
    },
    {
      deal_id: other.id,
      actor: email,
      action: 'listing_merged_away',
      detail: { into: keepKey, intoAddress: keep.address },
    },
  ])
  revalidateDeal(keepKey)
  revalidateDeal(otherKey)
  return { ok: true }
}
