'use server'

/**
 * Lead Flows CRUD actions (FUB §8.3).
 *
 * Owner/superuser only — lead flows decide how every incoming lead is routed.
 * Reads: lib/data/crm/getLeadFlow.ts (cached, tag 'lead-flows').
 *
 * Each flow has:
 *   - source (unique — matches crm_people.source values)
 *   - display_name (human label shown in the UI)
 *   - a default distribution target (broker slug | group id | pond id)
 *   - ordered rules with conditions and a distribution target override
 */

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import type { LeadFlowCondition } from '@/lib/data/crm/getLeadFlow'

export type LeadFlowsResult = { ok: true; id?: number } | { ok: false; error: string }

async function requireOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }
  if (access.role !== 'superuser') return { ok: false, error: 'Only the owner can manage lead flows' }
  return { ok: true }
}

function bust() {
  revalidateTag('lead-flows', 'max')
}

/**
 * Parse the distribution target fields from a FormData.
 * Exactly one of broker_slug / group_id / pond_id should be set.
 */
function parseTarget(formData: FormData): {
  assigned_broker_slug: string | null
  assigned_group_id: number | null
  assigned_pond_id: number | null
} {
  const brokerSlug = String(formData.get('assigned_broker_slug') ?? '').trim() || null
  const rawGroup = formData.get('assigned_group_id')
  const assignedGroupId = rawGroup && String(rawGroup).trim() !== '' ? Number(rawGroup) : null
  const rawPond = formData.get('assigned_pond_id')
  const assignedPondId = rawPond && String(rawPond).trim() !== '' ? Number(rawPond) : null
  return {
    assigned_broker_slug: brokerSlug,
    assigned_group_id: Number.isFinite(assignedGroupId) ? assignedGroupId : null,
    assigned_pond_id: Number.isFinite(assignedPondId) ? assignedPondId : null,
  }
}

/** Create a new lead flow for a source. */
export async function createLeadFlowAction(formData: FormData): Promise<LeadFlowsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const source = String(formData.get('source') ?? '').trim()
  const displayName = String(formData.get('display_name') ?? '').trim() || source
  if (!source) return { ok: false, error: 'Source is required' }
  const target = parseTarget(formData)
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('lead_flows')
    .insert({ source, display_name: displayName, ...target })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true, id: (data as { id: number }).id }
}

/** Update a lead flow's display name or default distribution target. */
export async function updateLeadFlowAction(formData: FormData): Promise<LeadFlowsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing flow id' }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const displayName = String(formData.get('display_name') ?? '').trim()
  if (displayName) update.display_name = displayName
  const archivedRaw = formData.get('archived')
  if (archivedRaw !== null) update.archived = archivedRaw === 'true'
  // Allow clearing and resetting the target when any target field is present in the form.
  if (
    formData.has('assigned_broker_slug') ||
    formData.has('assigned_group_id') ||
    formData.has('assigned_pond_id')
  ) {
    Object.assign(update, parseTarget(formData))
  }
  const sb = createServiceClient()
  const { error } = await sb.from('lead_flows').update(update).eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Archive (soft-delete) a lead flow. */
export async function archiveLeadFlowAction(formData: FormData): Promise<LeadFlowsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing flow id' }
  const sb = createServiceClient()
  const { error } = await sb
    .from('lead_flows')
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Hard-delete a lead flow (cascades to rules). */
export async function deleteLeadFlowAction(formData: FormData): Promise<LeadFlowsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing flow id' }
  const sb = createServiceClient()
  const { error } = await sb.from('lead_flows').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/**
 * Upsert a lead flow rule.
 * Pass id to update an existing rule; omit to create a new one.
 * conditions is a JSON array of LeadFlowCondition objects.
 */
export async function upsertLeadFlowRuleAction(formData: FormData): Promise<LeadFlowsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const flowId = Number(formData.get('flow_id'))
  if (!Number.isFinite(flowId) || flowId <= 0) return { ok: false, error: 'Missing flow id' }
  const position = Number(formData.get('position') ?? 0)
  const conditionMatch = String(formData.get('condition_match') ?? 'all').trim()
  if (!['all', 'any'].includes(conditionMatch)) return { ok: false, error: 'Invalid condition_match' }
  let conditions: LeadFlowCondition[]
  try {
    const raw = JSON.parse(String(formData.get('conditions') ?? '[]')) as unknown
    conditions = Array.isArray(raw) ? (raw as LeadFlowCondition[]) : []
  } catch {
    return { ok: false, error: 'Invalid conditions JSON' }
  }
  const target = parseTarget(formData)
  const existingId = formData.get('id') ? Number(formData.get('id')) : null
  const sb = createServiceClient()

  if (existingId && Number.isFinite(existingId) && existingId > 0) {
    const { error } = await sb
      .from('lead_flow_rules')
      .update({ position, condition_match: conditionMatch, conditions, ...target, updated_at: new Date().toISOString() })
      .eq('id', existingId)
      .eq('flow_id', flowId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { data, error } = await sb
      .from('lead_flow_rules')
      .insert({ flow_id: flowId, position, condition_match: conditionMatch, conditions, ...target })
      .select('id')
      .single()
    if (error) return { ok: false, error: error.message }
    bust()
    return { ok: true, id: (data as { id: number }).id }
  }
  bust()
  return { ok: true }
}

/** Delete a lead flow rule. */
export async function deleteLeadFlowRuleAction(formData: FormData): Promise<LeadFlowsResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing rule id' }
  const sb = createServiceClient()
  const { error } = await sb.from('lead_flow_rules').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}
