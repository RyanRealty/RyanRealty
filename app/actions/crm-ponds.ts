'use server'

/**
 * CRM Ponds CRUD actions (CRM §8.2).
 *
 * Owner/superuser only for create/update/delete/membership.
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

