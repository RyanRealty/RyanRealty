/**
 * Adopt-once e-sign. The signer picks Draw, Type, or Upload, then taps each
 * Sign box. No app. Initials come from the legal name on the envelope.
 */
import type { SignFieldType } from './signing'

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

export function nextRequiredFieldId(
  fields: ReadonlyArray<{ id: string; required: boolean; type: SignFieldType }>,
  filledIds: ReadonlySet<string>,
): string | null {
  const next = fields.find((f) => f.required && fieldNeedsAdoptedMark(f.type) && !filledIds.has(f.id))
    ?? fields.find((f) => f.required && !filledIds.has(f.id))
  return next?.id ?? null
}
