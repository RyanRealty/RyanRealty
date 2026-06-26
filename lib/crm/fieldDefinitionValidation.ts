/**
 * Pure validation for the CRM custom-field registry write path.
 *
 * These helpers carry no server dependency (no 'server-only', no DB, no
 * next/cache) so they are unit-testable in isolation AND reusable by the UI for
 * inline validation. The 'use server' action in app/actions/crm-field-definitions
 * imports + re-runs them as the authoritative server-side guard.
 */

import {
  CRM_FIELD_TYPES,
  normalizeFieldType,
  normalizeFieldOptions,
  type CrmFieldType,
  type CrmFieldOption,
} from '@/lib/data/crm/getCrmFieldDefinitions'

/** Result of a field-definition mutation action. */
export type CrmFieldDefinitionResult =
  | { ok: true; id?: number; message?: string }
  | { ok: false; error: string }

/** Input for creating or updating a field definition. */
export type CrmFieldDefinitionInput = {
  key?: string
  label?: string
  type?: CrmFieldType
  options?: CrmFieldOption[]
  position?: number
  hideIfEmpty?: boolean
  readOnly?: boolean
  fieldGroup?: string | null
}

/** A machine key must start with a letter and use only letters, digits, _. */
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/

/**
 * Validate + normalize a field key. Keys must be a stable machine identifier so
 * they map cleanly to a crm_people.custom jsonb key. Pure.
 */
export function validateFieldKey(value: unknown): { ok: true; key: string } | { ok: false; error: string } {
  if (typeof value !== 'string') return { ok: false, error: 'A field key is required' }
  const key = value.trim()
  if (!key) return { ok: false, error: 'A field key is required' }
  if (key.length > 64) return { ok: false, error: 'Field key must be 64 characters or fewer' }
  if (!KEY_PATTERN.test(key)) {
    return { ok: false, error: 'Field key must start with a letter and use only letters, numbers, and underscores' }
  }
  return { ok: true, key }
}

/**
 * Validate the create payload into a clean DB row shape. A select-typed field
 * must carry at least one option. Pure.
 */
export function validateCreateInput(
  input: CrmFieldDefinitionInput,
): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const keyCheck = validateFieldKey(input.key)
  if (!keyCheck.ok) return keyCheck

  const label = typeof input.label === 'string' ? input.label.trim() : ''
  if (!label) return { ok: false, error: 'A label is required' }
  if (label.length > 120) return { ok: false, error: 'Label must be 120 characters or fewer' }

  if (input.type !== undefined && !CRM_FIELD_TYPES.includes(input.type)) {
    return { ok: false, error: 'Invalid field type' }
  }
  const type = normalizeFieldType(input.type)
  const options = type === 'select' ? normalizeFieldOptions(input.options) : []
  if (type === 'select' && options.length === 0) {
    return { ok: false, error: 'A select field needs at least one option' }
  }

  const position = Number.isFinite(Number(input.position)) ? Number(input.position) : 0

  return {
    ok: true,
    row: {
      key: keyCheck.key,
      label,
      type,
      options,
      position,
      hide_if_empty: input.hideIfEmpty === true,
      read_only: input.readOnly === true,
      field_group: typeof input.fieldGroup === 'string' && input.fieldGroup.trim() ? input.fieldGroup.trim() : null,
    },
  }
}

/**
 * Build the editable patch for an update. The key is immutable (renaming would
 * orphan every stored value). Returns either the patch object or a validation
 * error. Pure — the action applies the patch through the service client.
 */
export function buildUpdatePatch(
  input: CrmFieldDefinitionInput,
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const patch: Record<string, unknown> = {}

  if (input.label !== undefined) {
    const label = typeof input.label === 'string' ? input.label.trim() : ''
    if (!label) return { ok: false, error: 'A label is required' }
    if (label.length > 120) return { ok: false, error: 'Label must be 120 characters or fewer' }
    patch.label = label
  }

  let type: CrmFieldType | undefined
  if (input.type !== undefined) {
    if (!CRM_FIELD_TYPES.includes(input.type)) return { ok: false, error: 'Invalid field type' }
    type = input.type
    patch.type = type
  }

  if (input.options !== undefined || type === 'select') {
    if (type === 'select' || input.type === undefined) {
      const options = normalizeFieldOptions(input.options)
      if (type === 'select' && options.length === 0) {
        return { ok: false, error: 'A select field needs at least one option' }
      }
      patch.options = options
    }
  }
  // Switching a field away from select clears any stale options.
  if (type !== undefined && type !== 'select') patch.options = []

  if (input.position !== undefined) {
    patch.position = Number.isFinite(Number(input.position)) ? Number(input.position) : 0
  }
  if (input.hideIfEmpty !== undefined) patch.hide_if_empty = input.hideIfEmpty === true
  if (input.readOnly !== undefined) patch.read_only = input.readOnly === true
  if (input.fieldGroup !== undefined) {
    patch.field_group =
      typeof input.fieldGroup === 'string' && input.fieldGroup.trim() ? input.fieldGroup.trim() : null
  }

  return { ok: true, patch }
}
