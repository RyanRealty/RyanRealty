/**
 * tc_deal_people — many CRM people on one Vault deal.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0 (CRM person ↔ TC deal).
 * Raw .from() stays here (G1). No SkySlope writes.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import {
  dedupeParties,
  parseCityFromAddress,
  propertyKeyForInhouseDeal,
  type DealPersonRole,
} from '@/lib/tc/deal-people'
import {
  EMPTY_PROPERTY_FACTS,
  brokerRoleFromDealParties,
  seedChecklistItems,
} from '@/lib/tc/required-documents'

export type DealParty = {
  id: string
  dealId: string
  personId: number
  role: DealPersonRole
  name: string | null
}

export type PersonDealLink = {
  dealId: string
  propertyKey: string
  address: string
  stage: string
  role: DealPersonRole
}

export type CreateDealWithPeopleInput = {
  address: string
  city?: string | null
  brokerName: string | null
  parties: ReadonlyArray<{ personId: number; role: DealPersonRole }>
  actor: string
}

function client() {
  return createServiceClient()
}

export async function getDealParties(dealId: string): Promise<DealParty[]> {
  const sb = client()
  const { data, error } = await sb
    .from('tc_deal_people')
    .select('id, deal_id, person_id, role, crm_people(name)')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('[getDealParties]', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const person = row.crm_people as { name: string | null } | { name: string | null }[] | null
    const name = Array.isArray(person) ? person[0]?.name ?? null : person?.name ?? null
    return {
      id: String(row.id),
      dealId: String(row.deal_id),
      personId: Number(row.person_id),
      role: row.role as DealPersonRole,
      name,
    }
  })
}

export async function getDealsForPerson(personId: number): Promise<PersonDealLink[]> {
  const sb = client()
  const { data, error } = await sb
    .from('tc_deal_people')
    .select('role, tc_deals(id, property_key, address, stage)')
    .eq('person_id', personId)
  if (error) {
    console.error('[getDealsForPerson]', error.message)
    return []
  }
  const out: PersonDealLink[] = []
  for (const row of data ?? []) {
    const deal = row.tc_deals as
      | { id: string; property_key: string; address: string; stage: string }
      | { id: string; property_key: string; address: string; stage: string }[]
      | null
    const d = Array.isArray(deal) ? deal[0] : deal
    if (!d) continue
    out.push({
      dealId: String(d.id),
      propertyKey: String(d.property_key),
      address: String(d.address),
      stage: String(d.stage),
      role: row.role as DealPersonRole,
    })
  }
  return out
}

export async function getPartyNamesByDealIds(
  dealIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (dealIds.length === 0) return out
  const sb = client()
  const { data, error } = await sb
    .from('tc_deal_people')
    .select('deal_id, crm_people(name)')
    .in('deal_id', dealIds)
  if (error) {
    console.error('[getPartyNamesByDealIds]', error.message)
    return out
  }
  for (const row of data ?? []) {
    const dealId = String(row.deal_id)
    const person = row.crm_people as { name: string | null } | { name: string | null }[] | null
    const name = Array.isArray(person) ? person[0]?.name : person?.name
    if (!name?.trim()) continue
    const list = out.get(dealId) ?? []
    list.push(name.trim())
    out.set(dealId, list)
  }
  return out
}

export async function addPersonToDeal(input: {
  dealId: string
  personId: number
  role: DealPersonRole
  actor: string
}): Promise<{ error: string | null }> {
  const sb = client()
  const { error } = await sb.from('tc_deal_people').insert({
    deal_id: input.dealId,
    person_id: input.personId,
    role: input.role,
  })
  if (error) {
    if (error.code === '23505') return { error: 'That person is already on this deal.' }
    console.error('[addPersonToDeal]', error)
    return { error: 'Could not add that person to the deal.' }
  }
  await sb.from('tc_events').insert({
    deal_id: input.dealId,
    actor: input.actor,
    action: 'person_added',
    detail: { personId: input.personId, role: input.role },
  })
  return { error: null }
}

export async function removePersonFromDeal(input: {
  dealId: string
  linkId: string
  actor: string
}): Promise<{ error: string | null }> {
  const sb = client()
  const { data: row } = await sb
    .from('tc_deal_people')
    .select('id, person_id, role')
    .eq('id', input.linkId)
    .eq('deal_id', input.dealId)
    .maybeSingle()
  if (!row) return { error: 'Party not found.' }
  const { count } = await sb
    .from('tc_deal_people')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', input.dealId)
  if ((count ?? 0) <= 1) return { error: 'A deal needs at least one person.' }
  const { error } = await sb.from('tc_deal_people').delete().eq('id', input.linkId)
  if (error) {
    console.error('[removePersonFromDeal]', error)
    return { error: 'Could not remove that person.' }
  }
  await sb.from('tc_events').insert({
    deal_id: input.dealId,
    actor: input.actor,
    action: 'person_removed',
    detail: { personId: row.person_id, role: row.role },
  })
  return { error: null }
}

export async function createDealWithPeople(
  input: CreateDealWithPeopleInput,
): Promise<{ data: { dealId: string; propertyKey: string } | null; error: string | null }> {
  const parties = dedupeParties(input.parties)
  if (parties.length === 0) return { data: null, error: 'Add at least one person.' }
  const address = input.address.trim()
  if (!address) return { data: null, error: 'Address is required.' }

  const sb = client()
  const dealId = crypto.randomUUID()
  const cycleId = crypto.randomUUID()
  const propertyKey = propertyKeyForInhouseDeal(address, dealId)
  const city = input.city?.trim() || parseCityFromAddress(address)

  const { error: dealErr } = await sb.from('tc_deals').insert({
    id: dealId,
    property_key: propertyKey,
    address,
    city,
    state: 'OR',
    broker_name: input.brokerName,
    stage: 'pending',
    stage_detail: 'Accepted offer',
  })
  if (dealErr) {
    console.error('[createDealWithPeople] deal', dealErr)
    return { data: null, error: 'Could not create the deal.' }
  }

  const { error: cycleErr } = await sb.from('tc_cycles').insert({
    id: cycleId,
    deal_id: dealId,
    kind: 'sale',
    source: 'inhouse',
    source_guid: `inhouse:${cycleId}`,
    status: 'Pending',
    broker_name: input.brokerName,
  })
  if (cycleErr) {
    console.error('[createDealWithPeople] cycle', cycleErr)
    await sb.from('tc_deals').delete().eq('id', dealId)
    return { data: null, error: 'Could not create the deal cycle.' }
  }

  const { error: partyErr } = await sb.from('tc_deal_people').insert(
    parties.map((p) => ({
      deal_id: dealId,
      person_id: p.personId,
      role: p.role,
    })),
  )
  if (partyErr) {
    console.error('[createDealWithPeople] parties', partyErr)
    await sb.from('tc_deals').delete().eq('id', dealId)
    return { data: null, error: 'Could not attach people to the deal.' }
  }

  const role = brokerRoleFromDealParties(parties.map((p) => p.role))
  const checklist = seedChecklistItems(role, EMPTY_PROPERTY_FACTS)
  if (checklist.length) {
    const { error: checkErr } = await sb.from('tc_checklist_items').insert(
      checklist.map((row) => ({
        cycle_id: cycleId,
        name: row.name,
        type_name: row.type_name,
        status: row.status,
        sort_order: row.sort_order,
      })),
    )
    if (checkErr) {
      console.error('[createDealWithPeople] checklist', checkErr)
    }
  }

  await sb.from('tc_events').insert({
    deal_id: dealId,
    cycle_id: cycleId,
    actor: input.actor,
    action: 'deal_created',
    detail: { propertyKey, parties, role, checklist: checklist.length },
  })

  return { data: { dealId, propertyKey }, error: null }
}
