/**
 * Required form content — not just signatures.
 * The form is complete only when every required blank is filled.
 * Signer fields (signature / initials / name / date / time) are filled at
 * signing. Prepare fields (text, unassigned checkboxes) must be filled
 * before send. Do not invent values.
 */
import { SIGN_FIELD_LABEL, isSenderAnnotation, type SignFieldType, type SignFieldValue } from './signing'

export const SIGNER_COMPLETED_TYPES = new Set<string>([
  'signature',
  'initials',
  'full_name',
  'date_signed',
  'time_signed',
])

export type RequiredFieldSnapshot = {
  type: string
  required?: boolean | null
  optional?: boolean | null
  recipientId?: string | null
  value?: SignFieldValue | null
  label?: string | null
}

export function isRequiredContentField(field: RequiredFieldSnapshot): boolean {
  if (isSenderAnnotation(field.type)) return false
  if (field.optional) return false
  return field.required !== false
}

export function isPrepareField(field: RequiredFieldSnapshot): boolean {
  if (!isRequiredContentField(field)) return false
  if (SIGNER_COMPLETED_TYPES.has(field.type)) return !field.recipientId
  return !field.recipientId
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

export function missingPrepareFields(fields: readonly RequiredFieldSnapshot[]): RequiredFieldSnapshot[] {
  return fields.filter((f) => isPrepareField(f) && !fieldValueIsComplete(f.type, f.value))
}

export function missingCompleteFields(fields: readonly RequiredFieldSnapshot[]): RequiredFieldSnapshot[] {
  return fields.filter((f) => isRequiredContentField(f) && !fieldValueIsComplete(f.type, f.value))
}

export function unassignedRequiredSignFields(fields: readonly RequiredFieldSnapshot[]): RequiredFieldSnapshot[] {
  return fields.filter(
    (f) => isRequiredContentField(f) && SIGNER_COMPLETED_TYPES.has(f.type) && !f.recipientId,
  )
}

function listLabels(fields: readonly RequiredFieldSnapshot[]): string {
  const labels = [...new Set(fields.map(fieldLabel))]
  if (labels.length <= 3) return labels.join(', ')
  return `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`
}

export function incompletePrepareMessage(fields: readonly RequiredFieldSnapshot[]): string | null {
  const unassigned = unassignedRequiredSignFields(fields)
  if (unassigned.length) {
    return `This form still needs a ${listLabels(unassigned)} assigned to a signer. Signatures are not enough — the form must be completed as required.`
  }
  const missing = missingPrepareFields(fields)
  if (!missing.length) return null
  return `This form still needs ${listLabels(missing)} filled in. Signatures are not enough — the form must be completed as required before sending.`
}

export function incompleteFormMessage(fields: readonly RequiredFieldSnapshot[]): string | null {
  const missing = missingCompleteFields(fields)
  if (!missing.length) return null
  return `This form is not complete. Required ${listLabels(missing)} ${missing.length === 1 ? 'is' : 'are'} still empty. Signatures are not enough.`
}
