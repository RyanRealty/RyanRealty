'use server'

/**
 * CRM automation rule CRUD — the server-action surface over the
 * crm_automation_rules table (the UI-configurable replacement for the hardcoded
 * RULES const in lib/crm/enroll.ts).
 *
 * Every method is access-guarded (getCrmAccess) and returns the standard
 * { ok } | { ok:false, error } result. Create + update VALIDATE that the action
 * target actually exists before writing — an enroll_sequence rule pointing at a
 * dead sequence id, or a set_stage rule pointing at an unknown stage, would
 * silently no-op in the engine, so it is refused at write time.
 *
 * DAL boundary (G1): the cached READ side lives in lib/data/crm/
 * getCrmAutomationRules; mutations here revalidate that cache tag + the manager
 * page. The pure reorder helper is reused from lib/crm/config-table.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { reorderPositions, type ConfigResult } from '@/lib/crm/config-table'
import {
  CRM_AUTOMATION_RULES_TAG,
  isActionType,
  isTriggerType,
  type CrmActionType,
  type CrmTriggerType,
} from '@/lib/data/crm/getCrmAutomationRules'
import { CRM_BROKERS } from '@/lib/crm/constants'

const REVALIDATE_PATHS = ['/admin/crm/automations', '/admin/crm/settings']

function bust() {
  revalidateTag(CRM_AUTOMATION_RULES_TAG, 'max')
  for (const p of REVALIDATE_PATHS) revalidatePath(p)
}

/**
 * Mutating an automation rule is an OWNER operation. These rules reshape every
 * contact that hits a trigger (an assign_broker rule reassigns leads between
 * brokers, mirroring assignCrmBrokerAction which is superuser-only). A restricted
 * broker must never be able to create, edit, reorder, toggle, or delete one, so
 * every CRUD action here requires the superuser role, unconditionally.
 */
async function requireAccess(): Promise<ConfigResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  if (access.role !== 'superuser') {
    return { ok: false, error: 'Not authorized. Only an owner can manage automation rules.' }
  }
  return { ok: true }
}

/**
 * Validate that the action's target exists. Returns ok:false with a stable
 * message when an enroll_sequence id, add_tag/set_stage key, or assign_broker
 * slug doesn't resolve. Exported-shaped logic kept inline because it needs a DB.
 */
async function validateActionTarget(actionType: CrmActionType, actionValue: string): Promise<ConfigResult> {
  const value = actionValue.trim()
  if (!value) return { ok: false, error: 'Action value is required' }
  const sb = createServiceClient()

  if (actionType === 'enroll_sequence') {
    const id = Number(value)
    if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Pick a workflow to enroll into' }
    const { data } = await sb.from('crm_sequences').select('id').eq('id', id).maybeSingle()
    if (!data) return { ok: false, error: 'That workflow no longer exists' }
    return { ok: true }
  }
  if (actionType === 'add_tag') {
    const { data } = await sb.from('crm_tags').select('key').eq('key', value).maybeSingle()
    if (!data) return { ok: false, error: `Tag "${value}" is not in the taxonomy` }
    return { ok: true }
  }
  if (actionType === 'set_stage') {
    const { data } = await sb.from('crm_stages').select('key').eq('key', value).maybeSingle()
    if (!data) return { ok: false, error: `Stage "${value}" does not exist` }
    return { ok: true }
  }
  // assign_broker
  if (!(CRM_BROKERS as readonly string[]).includes(value)) {
    return { ok: false, error: `Broker "${value}" is not a valid broker` }
  }
  return { ok: true }
}

/**
 * Validate the trigger value shape. inactivity carries a positive integer day
 * count; the other triggers carry a non-empty string. Pure given the inputs.
 */
function validateTriggerValue(triggerType: CrmTriggerType, triggerValue: string): ConfigResult {
  const value = triggerValue.trim()
  if (!value) return { ok: false, error: 'Trigger value is required' }
  if (triggerType === 'inactivity') {
    const days = Number(value)
    if (!Number.isInteger(days) || days <= 0) return { ok: false, error: 'Inactivity days must be a positive whole number' }
  }
  return { ok: true }
}

export async function createCrmAutomationRuleAction(formData: FormData): Promise<ConfigResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard

  const name = String(formData.get('name') ?? '').trim()
  const triggerTypeRaw = String(formData.get('triggerType') ?? '').trim()
  const triggerValue = String(formData.get('triggerValue') ?? '').trim()
  const actionTypeRaw = String(formData.get('actionType') ?? '').trim()
  const actionValue = String(formData.get('actionValue') ?? '').trim()

  if (!name) return { ok: false, error: 'Name is required' }
  if (!isTriggerType(triggerTypeRaw)) return { ok: false, error: 'Unknown trigger type' }
  if (!isActionType(actionTypeRaw)) return { ok: false, error: 'Unknown action type' }

  const triggerCheck = validateTriggerValue(triggerTypeRaw, triggerValue)
  if (!triggerCheck.ok) return triggerCheck
  const actionCheck = await validateActionTarget(actionTypeRaw, actionValue)
  if (!actionCheck.ok) return actionCheck

  const sb = createServiceClient()
  // New rules land at the end of the order.
  const { data: maxRow } = await sb
    .from('crm_automation_rules')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextPosition = ((maxRow?.position as number | undefined) ?? -1) + 1

  const { error } = await sb.from('crm_automation_rules').insert({
    name,
    is_active: true,
    trigger_type: triggerTypeRaw,
    trigger_value: triggerValue,
    action_type: actionTypeRaw,
    action_value: actionValue,
    position: nextPosition,
  })
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

export async function updateCrmAutomationRuleAction(formData: FormData): Promise<ConfigResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard

  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Rule required' }
  const name = String(formData.get('name') ?? '').trim()
  const triggerTypeRaw = String(formData.get('triggerType') ?? '').trim()
  const triggerValue = String(formData.get('triggerValue') ?? '').trim()
  const actionTypeRaw = String(formData.get('actionType') ?? '').trim()
  const actionValue = String(formData.get('actionValue') ?? '').trim()

  if (!name) return { ok: false, error: 'Name is required' }
  if (!isTriggerType(triggerTypeRaw)) return { ok: false, error: 'Unknown trigger type' }
  if (!isActionType(actionTypeRaw)) return { ok: false, error: 'Unknown action type' }

  const triggerCheck = validateTriggerValue(triggerTypeRaw, triggerValue)
  if (!triggerCheck.ok) return triggerCheck
  const actionCheck = await validateActionTarget(actionTypeRaw, actionValue)
  if (!actionCheck.ok) return actionCheck

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_automation_rules')
    .update({
      name,
      trigger_type: triggerTypeRaw,
      trigger_value: triggerValue,
      action_type: actionTypeRaw,
      action_value: actionValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

export async function setCrmAutomationRuleActiveAction(formData: FormData): Promise<ConfigResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard
  const id = Number(formData.get('id'))
  const isActive = String(formData.get('isActive') ?? '') === '1'
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Rule required' }
  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_automation_rules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

export async function deleteCrmAutomationRuleAction(formData: FormData): Promise<ConfigResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Rule required' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_automation_rules').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

export async function reorderCrmAutomationRulesAction(orderedIds: number[]): Promise<ConfigResult> {
  const guard = await requireAccess()
  if (!guard.ok) return guard
  if (!Array.isArray(orderedIds) || orderedIds.some((n) => !Number.isFinite(n))) {
    return { ok: false, error: 'Bad order' }
  }
  const sb = createServiceClient()
  const { data: rows } = await sb
    .from('crm_automation_rules')
    .select('id')
    .order('position', { ascending: true })
    .order('id', { ascending: true })
  const currentIds = (rows ?? []).map((r) => Number(r.id))
  const updates = reorderPositions(currentIds, orderedIds)
  for (const u of updates) {
    const { error } = await sb
      .from('crm_automation_rules')
      .update({ position: u.position, updated_at: new Date().toISOString() })
      .eq('id', u.id)
    if (error) return { ok: false, error: error.message }
  }
  bust()
  return { ok: true }
}

/** Read passthrough so the automations settings page lists rules from one import. */
export async function listCrmAutomationRulesAction() {
  const access = await getCrmAccess()
  if (!access) return []
  const { getCrmAutomationRules } = await import('@/lib/data/crm/getCrmAutomationRules')
  return getCrmAutomationRules()
}
