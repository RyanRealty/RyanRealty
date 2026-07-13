'use server'

/**
 * CRM lead-routing config mutations (Wave 7). The routing strategy lives in the
 * single-row crm_assignment_config (plus by_source rules in crm_assignment_rules)
 * from migration 20260625211000_crm_assignment_config. These actions make the
 * routing strategy editable from the Phase B settings UI instead of a code
 * constant. Read side: lib/data/crm/getCrmAssignmentConfig.ts (cached, tag
 * 'crm-assignment-config'). The engine that consumes it: lib/crm/lead-routing.ts.
 *
 * Owner/superuser only — lead routing decides which broker earns a lead, so a
 * non-owner must never mutate it. Live behavior stays all-to-Matt until an owner
 * flips the strategy here (no deploy needed).
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { normalizeStrategy, type AssignmentStrategy } from '@/lib/data/crm/getCrmAssignmentConfig'

export type CrmAssignmentResult = { ok: true } | { ok: false; error: string }

async function requireOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }
  if (access.role !== 'superuser') return { ok: false, error: 'Only the owner can change lead routing' }
  return { ok: true }
}

function bust() {
  revalidateTag('crm-assignment-config', 'max')
  revalidatePath('/admin/crm/settings/routing')
}

/** Set the routing strategy (all_to_one | round_robin | by_source). */
export async function setStrategyAction(formData: FormData): Promise<CrmAssignmentResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const strategy: AssignmentStrategy = normalizeStrategy(String(formData.get('strategy') ?? ''))
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_assignment_config')
    .update({ strategy, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Set the default broker (used by all_to_one + as the by_source fallback). */
export async function setDefaultBrokerAction(formData: FormData): Promise<CrmAssignmentResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const broker = String(formData.get('broker') ?? '').trim()
  if (!broker) return { ok: false, error: 'Missing broker' }
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_assignment_config')
    .update({ default_broker: broker, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Create or update a by_source rule (one rule per source — upsert on source). */
export async function upsertSourceRuleAction(formData: FormData): Promise<CrmAssignmentResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const source = String(formData.get('source') ?? '').trim()
  const broker = String(formData.get('broker') ?? '').trim()
  if (!source || !broker) return { ok: false, error: 'Source and broker are required' }
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_assignment_rules')
    .upsert({ source, broker, updated_at: new Date().toISOString() }, { onConflict: 'source' })
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Delete a by_source rule by id. */
export async function deleteSourceRuleAction(formData: FormData): Promise<CrmAssignmentResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'Missing rule' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_assignment_rules').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}
