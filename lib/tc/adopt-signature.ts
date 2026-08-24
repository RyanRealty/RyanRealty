/**
 * Adopt-once e-sign. The signer picks Draw, Type, or Upload, then taps each
 * Sign box. No app. Initials come from the legal name on the envelope.
 */
import type { SignFieldType, SignFieldValue } from './signing'

export const ADOPT_METHODS = ['draw', 'type', 'upload'] as const
export type AdoptMethod = (typeof ADOPT_METHODS)[number]

export const ADOPT_METHOD_LABEL: Record<AdoptMethod, string> = {
  draw: 'Draw',
  type: 'Type',
  upload: 'Upload',
}

export function initialsFromFullName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  const first = parts[0]?.[0] ?? ''
  const last = parts[parts.length - 1]?.[0] ?? ''
  return `${first}${last}`.toUpperCase()
}

export function fieldNeedsAdoptedMark(type: SignFieldType): boolean {
  return type === 'signature' || type === 'initials'
}

/** Name, date, and time are prepared — the signer only taps Sign and Initials. */
export function stampPreparedSignerFields(
  fields: ReadonlyArray<{ id: string; type: string; recipientId?: string | null }>,
  input: { recipientId: string; name: string; date: string; time: string },
): { fieldId: string; value: SignFieldValue }[] {
  const out: { fieldId: string; value: SignFieldValue }[] = []
  for (const f of fields) {
    if (f.recipientId && f.recipientId !== input.recipientId) continue
    if (f.type === 'full_name' && input.name.trim()) {
      out.push({ fieldId: f.id, value: { kind: 'text', text: input.name.trim() } })
    } else if (f.type === 'date_signed' && input.date.trim()) {
      out.push({ fieldId: f.id, value: { kind: 'date_signed', text: input.date.trim() } })
    } else if (f.type === 'time_signed' && input.time.trim()) {
      out.push({ fieldId: f.id, value: { kind: 'text', text: input.time.trim() } })
    }
  }
  return out
}

export function nextRequiredFieldId(
  fields: ReadonlyArray<{ id: string; required: boolean; type: SignFieldType }>,
  filledIds: ReadonlySet<string>,
): string | null {
  const next = fields.find((f) => f.required && fieldNeedsAdoptedMark(f.type) && !filledIds.has(f.id))
    ?? fields.find((f) => f.required && !filledIds.has(f.id))
  return next?.id ?? null
}
