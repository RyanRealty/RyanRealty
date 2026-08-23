/**
 * Per-form required content. Not every blank on a form is required.
 * Requirement comes from reading the form: explicit isOptional, signature
 * lines tagged to a role, and a small set of known facts per OREF number.
 * Unknown fields stay optional — do not invent requirements.
 */
import { FACT_LABEL, resolveFactKey, type DealFactKey, type DealFacts } from './oref-fill'
import { parseFormNumber } from './required-signers'
import {
  SIGN_FIELD_LABEL,
  isSenderAnnotation,
  type SignFieldType,
  type SignFieldValue,
} from './signing'
import type { SignerRole } from './skyslope-field-map'

export const SIGNER_COMPLETED_TYPES = new Set<string>([
  'signature',
  'initials',
  'full_name',
  'date_signed',
  'time_signed',
])

/** Core facts the named form is not complete without. Everything else is form-specific / optional. */
export const REQUIRED_FACTS_BY_FORM: Record<string, readonly DealFactKey[]> = {
  '001': ['address', 'buyers', 'sellers', 'salePrice'],
  '015': ['address', 'sellers', 'listingPrice'],
  '050': ['buyers'],
  '052': ['buyers'],
  '040': ['sellers'],
  '041': ['buyers'],
}

export type FieldRequirement = 'required' | 'optional' | 'unknown'

export type RequirementInput = {
  type?: string | null
  isOptional?: boolean | null
  optional?: boolean | null
  required?: boolean | null
  signerRole?: SignerRole | null
  dataRef?: string | null
  formNumber?: string | null
}

export type RequiredFieldSnapshot = {
  type: string
  required?: boolean | null
  optional?: boolean | null
  recipientId?: string | null
  value?: SignFieldValue | null
  label?: string | null
}

/**
 * What this field requires, from the form — never a default of "all fields".
 * Explicit isOptional / required wins. Signature lines tagged to a role are
 * required. Known OREF bindings (sale price on 001, list price on 015) are
 * required. Everything else is unknown and is not enforced.
 */
export function fieldRequirement(input: RequirementInput): FieldRequirement {
  const type = String(input.type ?? '')
  if (isSenderAnnotation(type)) return 'optional'
  if (input.isOptional === true || input.optional === true || input.required === false) return 'optional'
  if (input.isOptional === false || input.required === true) return 'required'
  if (SIGNER_COMPLETED_TYPES.has(type) && input.signerRole) return 'required'
  const form = parseFormNumber(input.formNumber) ?? input.formNumber?.trim()
  const fact = resolveFactKey(input.dataRef ?? '')
  if (form && fact && (REQUIRED_FACTS_BY_FORM[form] ?? []).includes(fact)) return 'required'
  return 'unknown'
}

export function mapFieldIsRequired(input: RequirementInput): boolean {
  return fieldRequirement(input) === 'required'
}

export function isRequiredContentField(field: RequiredFieldSnapshot): boolean {
  if (isSenderAnnotation(field.type)) return false
  if (field.optional) return false
  return field.required === true
}

export function fieldValueIsComplete(type: string, value: SignFieldValue | null | undefined): boolean {
  if (!value) return false
  if (type === 'signature' || type === 'initials') {
    return (value.kind === 'signature' || value.kind === 'initials') && !!value.png
  }
  if (type === 'checkbox') return value.kind === 'checkbox' && value.checked === true
  if (value.kind === 'date_signed' || value.kind === 'text') return !!value.text?.trim()
  if (value.kind === 'checkbox') return value.checked === true
  return false
}

export function fieldLabel(field: RequiredFieldSnapshot): string {
  const custom = field.label?.trim()
  if (custom) return custom
  const t = field.type as SignFieldType
  return SIGN_FIELD_LABEL[t] ?? 'field'
}

/** Unassigned signature lines the form marked required. Extra blanks are ignored. */
export function unassignedRequiredSignFields(fields: readonly RequiredFieldSnapshot[]): RequiredFieldSnapshot[] {
  return fields.filter(
    (f) => isRequiredContentField(f) && SIGNER_COMPLETED_TYPES.has(f.type) && !f.recipientId,
  )
}

export function missingPrepareFields(fields: readonly RequiredFieldSnapshot[]): RequiredFieldSnapshot[] {
  return unassignedRequiredSignFields(fields)
}

/** At complete: only required signer fields. Optional text/checkboxes may stay empty. */
export function missingCompleteFields(fields: readonly RequiredFieldSnapshot[]): RequiredFieldSnapshot[] {
  return fields.filter(
    (f) =>
      isRequiredContentField(f) &&
      SIGNER_COMPLETED_TYPES.has(f.type) &&
      !fieldValueIsComplete(f.type, f.value),
  )
}

function factPresent(facts: Partial<DealFacts>, key: DealFactKey): boolean {
  const v = facts[key]
  if (v == null) return false
  if (typeof v === 'string') return !!v.trim()
  if (typeof v === 'number') return Number.isFinite(v) && v > 0
  if (Array.isArray(v)) return v.some((n) => String(n ?? '').trim())
  return false
}

export function requiredFactsForForms(formNumbers: readonly (string | null | undefined)[]): DealFactKey[] {
  const seen = new Set<DealFactKey>()
  const out: DealFactKey[] = []
  for (const raw of formNumbers) {
    const n = parseFormNumber(raw) ?? String(raw ?? '').trim()
    for (const key of REQUIRED_FACTS_BY_FORM[n] ?? []) {
      if (seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

export function missingRequiredFacts(
  formNumbers: readonly (string | null | undefined)[],
  facts: Partial<DealFacts>,
): DealFactKey[] {
  return requiredFactsForForms(formNumbers).filter((k) => !factPresent(facts, k))
}

function listLabels(fields: readonly RequiredFieldSnapshot[]): string {
  const labels = [...new Set(fields.map(fieldLabel))]
  if (labels.length <= 3) return labels.join(', ')
  return `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`
}

export function incompletePrepareMessage(fields: readonly RequiredFieldSnapshot[]): string | null {
  const unassigned = unassignedRequiredSignFields(fields)
  if (!unassigned.length) return null
  return `This form still needs a ${listLabels(unassigned)} assigned to a signer.`
}

export function incompleteFactsMessage(missing: readonly DealFactKey[]): string | null {
  if (!missing.length) return null
  const labels = missing.map((k) => FACT_LABEL[k])
  const list = labels.length <= 3 ? labels.join(', ') : `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`
  return `This form still needs ${list} on the file. Optional blanks can stay empty — only this form's required facts block send.`
}

export function incompleteFormMessage(fields: readonly RequiredFieldSnapshot[]): string | null {
  const missing = missingCompleteFields(fields)
  if (!missing.length) return null
  return `This form is not complete. Required ${listLabels(missing)} ${missing.length === 1 ? 'is' : 'are'} still empty.`
}

export { FACT_LABEL }
