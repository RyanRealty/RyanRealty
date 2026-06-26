'use server'

/**
 * CRM Groups CRUD actions (FUB §8.1).
 *
 * Owner/superuser only — groups control broker distribution for lead flows.
 * Reads: lib/data/crm/getCrmGroups.ts (cached, tag 'crm-groups').
 */

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'

export type CrmGroupsResult = { ok: true; id?: number } | { ok: false; error: string }

async function requireOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }
  if (access.role !== 'superuser') return { ok: false, error: 'Only the owner can manage groups' }
  return { ok: true }
}

function bust() {
  revalidateTag('crm-groups', 'max')
  revalidateTag('lead-flows', 'max')
}

/** Create a new group. */
export async function createGroupAction(formData: FormData): Promise<CrmGroupsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const name = String(formData.get('name') ?? '').trim()
  const distributionType = String(formData.get('distribution_type') ?? 'round_robin').trim()
  if (!name) return { ok: false, error: 'Name is required' }
  if (!['round_robin', 'first_to_claim'].includes(distributionType)) {
    return { ok: false, error: 'Invalid distribution type' }
  }
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_groups')
    .insert({ name, distribution_type: distributionType })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true, id: (data as { id: number }).id }
}

/** Rename an existing group or change its distribution type. */
export async function updateGroupAction(formData: FormData): Promise<CrmGroupsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing group id' }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const name = String(formData.get('name') ?? '').trim()
  const distributionType = String(formData.get('distribution_type') ?? '').trim()
  if (name) update.name = name
  if (distributionType && ['round_robin', 'first_to_claim'].includes(distributionType)) {
    update.distribution_type = distributionType
  }
  if (Object.keys(update).length === 1) return { ok: false, error: 'Nothing to update' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_groups').update(update).eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Delete a group (cascades to members; lead_flows FKs set to null). */
export async function deleteGroupAction(formData: FormData): Promise<CrmGroupsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing group id' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_groups').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Add a broker to a group. */
export async function addGroupMemberAction(formData: FormData): Promise<CrmGroupsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const groupId = Number(formData.get('group_id'))
  const brokerSlug = String(formData.get('broker_slug') ?? '').trim()
  if (!Number.isFinite(groupId) || groupId <= 0) return { ok: false, error: 'Missing group id' }
  if (!brokerSlug) return { ok: false, error: 'Missing broker slug' }
  const sb = createServiceClient()
  // Get current max sort_order to append.
  const { data: existing } = await sb
    .from('crm_group_members')
    .select('sort_order')
    .eq('group_id', groupId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sortOrder = existing ? ((existing as { sort_order: number }).sort_order ?? 0) + 1 : 0
  const { error } = await sb
    .from('crm_group_members')
    .insert({ group_id: groupId, broker_slug: brokerSlug, sort_order: sortOrder })
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Remove a broker from a group. */
export async function removeGroupMemberAction(formData: FormData): Promise<CrmGroupsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const memberId = Number(formData.get('member_id'))
  if (!Number.isFinite(memberId) || memberId <= 0) return { ok: false, error: 'Missing member id' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_group_members').delete().eq('id', memberId)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}
