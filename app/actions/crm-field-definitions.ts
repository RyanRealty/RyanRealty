'use server'

/**
 * CRM custom-field registry actions (the schema layer over crm_people.custom).
 *
 * An admin defines, types, orders, and removes the custom fields the contact card
 * Details section and the saved-view AST custom-condition builder consume. These
 * actions are the write side of lib/data/crm/getCrmFieldDefinitions.ts.
 *
 * Hard rules:
 *   1. Admin-guarded the same way app/actions/crm.ts is (getCrmAccess). The
 *      registry is global brokerage config, not per-contact, so there is no
 *      per-person scope check. Only superusers may mutate it (a restricted broker
 *      cannot reshape every other broker's contact card).
 *   2. Deleting a definition removes ONLY the schema row. It NEVER strips the
 *      underlying values from crm_people.custom, and it REFUSES when the field is
 *      protected (a load-bearing system field).
 *   3. Every write revalidates the registry cache tag so the card + filters see
 *      the change immediately.
 *
 * DAL boundary (G1): mutations live here in a 'use server' module and write
 * through the service client; the typed reader lives in lib/data/crm.
 */

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { CRM_FIELD_DEFINITIONS_TAG } from '@/lib/data/crm/getCrmFieldDefinitions'
import {
  validateCreateInput,
  buildUpdatePatch,
  type CrmFieldDefinitionInput,
} from '@/lib/crm/fieldDefinitionValidation'

export type CrmFieldDefinitionResult = { ok: true; id?: number; message?: string } | { ok: false; error: string }
export type { CrmFieldDefinitionInput }

async function requireSuperuser(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  if (access.role !== 'superuser') {
    return { ok: false, error: 'Only an owner can change custom fields' }
  }
  return { ok: true }
}

/** Create a new custom-field definition. */
export async function createCrmFieldDefinitionAction(
  input: CrmFieldDefinitionInput,
): Promise<CrmFieldDefinitionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard

  const validated = validateCreateInput(input)
  if (!validated.ok) return validated

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_field_definitions')
    .insert(validated.row)
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'A field with that key already exists' }
    return { ok: false, error: error.message }
  }

  revalidateTag(CRM_FIELD_DEFINITIONS_TAG, 'max')
  return { ok: true, id: Number(data?.id), message: 'Field added' }
}

/**
 * Update an existing definition. The key is immutable (renaming it would orphan
 * every stored value). Only the editable attributes change.
 */
export async function updateCrmFieldDefinitionAction(
  id: number,
  input: CrmFieldDefinitionInput,
): Promise<CrmFieldDefinitionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard

  const defId = Number(id)
  if (!Number.isFinite(defId) || defId <= 0) return { ok: false, error: 'A field is required' }

  const built = buildUpdatePatch(input)
  if (!built.ok) return built
  const patch = { ...built.patch, updated_at: new Date().toISOString() }

  const sb = createServiceClient()
  const { error } = await sb.from('crm_field_definitions').update(patch).eq('id', defId)
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_FIELD_DEFINITIONS_TAG, 'max')
  return { ok: true, id: defId, message: 'Field updated' }
}

/**
 * Reorder the registry. Accepts the full ordered list of ids; each id's position
 * becomes its index in the list. Unknown ids are skipped. Single batched write.
 */
export async function reorderCrmFieldDefinitionsAction(
  orderedIds: number[],
): Promise<CrmFieldDefinitionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard

  const ids = (Array.isArray(orderedIds) ? orderedIds : [])
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return { ok: false, error: 'Nothing to reorder' }

  const sb = createServiceClient()
  const now = new Date().toISOString()
  const results = await Promise.all(
    ids.map((defId, index) =>
      sb.from('crm_field_definitions').update({ position: index, updated_at: now }).eq('id', defId),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) return { ok: false, error: failed.error.message }

  revalidateTag(CRM_FIELD_DEFINITIONS_TAG, 'max')
  return { ok: true, message: 'Order saved' }
}

/**
 * Delete a definition. Removes ONLY the schema row, never the values stored in
 * crm_people.custom (the data survives and the field can be re-added later).
 * Refuses to delete a protected system field.
 */
export async function deleteCrmFieldDefinitionAction(id: number): Promise<CrmFieldDefinitionResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard

  const defId = Number(id)
  if (!Number.isFinite(defId) || defId <= 0) return { ok: false, error: 'A field is required' }

  const sb = createServiceClient()
  const { data: existing, error: readErr } = await sb
    .from('crm_field_definitions')
    .select('is_protected')
    .eq('id', defId)
    .maybeSingle()
  if (readErr) return { ok: false, error: readErr.message }
  if (!existing) return { ok: false, error: 'That field no longer exists' }
  if (existing.is_protected === true) {
    return { ok: false, error: 'This is a protected system field and cannot be removed' }
  }

  const { error } = await sb.from('crm_field_definitions').delete().eq('id', defId)
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_FIELD_DEFINITIONS_TAG, 'max')
  return { ok: true, id: defId, message: 'Field removed' }
}
