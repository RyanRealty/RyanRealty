'use server'

/**
 * CRM Ponds CRUD + claim actions (FUB §8.2).
 *
 * Owner/superuser only for create/update/delete/membership.
 * Any broker can call claimLeadFromPondAction to claim a lead from a pond they
 * belong to (checked server-side).
 *
 * Reads: lib/data/crm/getCrmPonds.ts (cached, tag 'crm-ponds').
 */

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'

export type CrmPondsResult = { ok: true; id?: number } | { ok: false; error: string }

async function requireOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }
  if (access.role !== 'superuser') return { ok: false, error: 'Only the owner can manage ponds' }
  return { ok: true }
}

function bust() {
  revalidateTag('crm-ponds', 'max')
  revalidateTag('lead-flows', 'max')
}

/** Create a new pond. */
export async function createPondAction(formData: FormData): Promise<CrmPondsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const name = String(formData.get('name') ?? '').trim()
  const pondLeadSlug = String(formData.get('pond_lead_slug') ?? '').trim()
  if (!name) return { ok: false, error: 'Name is required' }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_ponds')
    .insert({ name, pond_lead_slug: pondLeadSlug })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true, id: (data as { id: number }).id }
}

/** Update a pond's name or pond_lead_slug. */
export async function updatePondAction(formData: FormData): Promise<CrmPondsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing pond id' }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const name = String(formData.get('name') ?? '').trim()
  // Only write pond_lead_slug when the field was explicitly submitted and non-empty.
  // A name-only blur sends no pond_lead_slug field, so rawSlug is null → skip the
  // update and preserve whatever slug the pond already has in the database.
  const rawSlug = formData.get('pond_lead_slug')
  const pondLeadSlug = rawSlug !== null ? String(rawSlug).trim() : null
  if (name) update.name = name
  if (pondLeadSlug !== null && pondLeadSlug !== '') update.pond_lead_slug = pondLeadSlug
  const sb = createServiceClient()
  const { error } = await sb.from('crm_ponds').update(update).eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Delete a pond (cascades to members; crm_people.pond_id sets to null). */
export async function deletePondAction(formData: FormData): Promise<CrmPondsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing pond id' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_ponds').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Add a broker to a pond. */
export async function addPondMemberAction(formData: FormData): Promise<CrmPondsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const pondId = Number(formData.get('pond_id'))
  const brokerSlug = String(formData.get('broker_slug') ?? '').trim()
  if (!Number.isFinite(pondId) || pondId <= 0) return { ok: false, error: 'Missing pond id' }
  if (!brokerSlug) return { ok: false, error: 'Missing broker slug' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_pond_members').insert({ pond_id: pondId, broker_slug: brokerSlug })
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Remove a broker from a pond. */
export async function removePondMemberAction(formData: FormData): Promise<CrmPondsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const memberId = Number(formData.get('member_id'))
  if (!Number.isFinite(memberId) || memberId <= 0) return { ok: false, error: 'Missing member id' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_pond_members').delete().eq('id', memberId)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/**
 * claimLeadFromPondAction — a pond member claims a specific lead.
 *
 * Validates that the calling broker is actually a member of the lead's pond,
 * sets assigned_broker, clears pond_id, and writes a crm_timeline 'note' row
 * marking the claim. Any broker (not owner-only) may call this.
 */
export async function claimLeadFromPondAction(formData: FormData): Promise<CrmPondsResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }
  const brokerSlug = access.brokerSlug
  if (!brokerSlug) return { ok: false, error: 'Your account is not mapped to a broker' }
  const personId = Number(formData.get('person_id'))
  if (!Number.isFinite(personId) || personId <= 0) return { ok: false, error: 'Missing person id' }

  const sb = createServiceClient()

  // Read the lead's current pond_id.
  const { data: person, error: readErr } = await sb
    .from('crm_people')
    .select('id, pond_id, name')
    .eq('id', personId)
    .maybeSingle()
  if (readErr || !person) return { ok: false, error: 'Lead not found' }
  const lead = person as { id: number; pond_id: number | null; name: string | null }
  if (!lead.pond_id) return { ok: false, error: 'This lead is not in a pond' }

  // Verify the calling broker is a member of this pond.
  const { data: membership, error: memErr } = await sb
    .from('crm_pond_members')
    .select('id')
    .eq('pond_id', lead.pond_id)
    .eq('broker_slug', brokerSlug)
    .maybeSingle()
  if (memErr || !membership) return { ok: false, error: 'You are not a member of this pond' }

  // Claim: set assigned_broker, clear pond_id.
  const { error: updateErr } = await sb
    .from('crm_people')
    .update({
      assigned_broker: brokerSlug,
      pond_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', personId)
    .eq('pond_id', lead.pond_id) // optimistic lock: only update if still in this pond
  if (updateErr) return { ok: false, error: updateErr.message }

  // Timeline note.
  await sb.from('crm_timeline').insert({
    person_id: personId,
    kind: 'note',
    title: 'Lead claimed from pond',
    body: `${brokerSlug} claimed this lead from pond #${lead.pond_id}.`,
    broker: brokerSlug,
    source: 'pond-claim',
  })

  revalidateTag('crm-groups', 'max')
  revalidateTag('crm-ponds', 'max')
  return { ok: true }
}
