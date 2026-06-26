'use server'

/**
 * contact-custom-fields — write a custom field value into crm_people.custom.
 *
 * Rules:
 *   1. Admin-guarded (getCrmAccess) + person-in-scope check.
 *   2. Only fields whose definition exists in crm_field_definitions may be
 *      written; the value is coerced to the field's type before storing.
 *   3. readOnly and isProtected fields refuse the write — the API is the only
 *      source of truth for those columns.
 *   4. Writes a crm_timeline entry so the change is audited on the contact.
 *   5. Revalidates the contact's console route so a page refresh reflects it.
 *
 * DAL boundary (G1): the service-client write lives here in app/actions/.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess, requirePersonInScope } from '@/app/actions/crm'
import { getCrmFieldDefinitions, getCrmFieldValue } from '@/lib/data/crm/getCrmFieldDefinitions'

export type CustomFieldWriteResult =
  | { ok: true; message?: string }
  | { ok: false; error: string }

/**
 * Persist one or more custom-field values for a contact.
 *
 * `values` is a plain object of { [fieldKey]: rawValue }. Each key is validated
 * against the field registry; unknown keys are silently dropped (defence-in-
 * depth so old UI fields do not explode on registry changes). readOnly +
 * isProtected fields refuse. The surviving values are merged (JSONB merge-patch)
 * into crm_people.custom — existing keys not in `values` are untouched.
 */
export async function saveContactCustomFieldsAction(
  personId: number,
  values: Record<string, unknown>,
): Promise<CustomFieldWriteResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const pid = Number(personId)
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, error: 'A contact is required' }

  const scoped = await requirePersonInScope(pid, access)
  if (!scoped.ok) return scoped

  const defs = await getCrmFieldDefinitions()
  const defMap = new Map(defs.map((d) => [d.key, d]))

  // Coerce + validate each submitted value against its definition.
  const patch: Record<string, unknown> = {}
  const changed: string[] = []

  for (const [key, rawValue] of Object.entries(values)) {
    const def = defMap.get(key)
    if (!def) continue // unknown key — drop silently
    if (def.readOnly) return { ok: false, error: `"${def.label}" is read-only` }
    if (def.isProtected) return { ok: false, error: `"${def.label}" cannot be changed from here` }

    // Use the same coercion logic the reader uses so stored value = displayed value.
    // For empty strings / nulls we store null (clears the field).
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      patch[key] = null
      changed.push(def.label)
      continue
    }

    const coerced = getCrmFieldValue({ [key]: rawValue }, def)
    patch[key] = coerced
    changed.push(def.label)
  }

  if (Object.keys(patch).length === 0) return { ok: true, message: 'Nothing to update' }

  const sb = createServiceClient()

  // Read current custom bag and merge.
  const { data: row, error: readErr } = await sb
    .from('crm_people')
    .select('custom')
    .eq('id', pid)
    .single()
  if (readErr) return { ok: false, error: readErr.message }

  const existing = (row?.custom ?? {}) as Record<string, unknown>
  const merged = { ...existing, ...patch }

  const { error: writeErr } = await sb
    .from('crm_people')
    .update({ custom: merged, updated_at: new Date().toISOString() })
    .eq('id', pid)
  if (writeErr) return { ok: false, error: writeErr.message }

  await sb.from('crm_timeline').insert({
    person_id: pid,
    kind: 'system',
    title: `Custom fields updated by ${access.email}: ${changed.join(', ')}`,
    source: 'app',
    broker: access.brokerSlug,
  })

  revalidatePath(`/admin/console/leads/${pid}`)
  revalidatePath('/admin/crm')

  return { ok: true, message: `Saved: ${changed.join(', ')}` }
}
