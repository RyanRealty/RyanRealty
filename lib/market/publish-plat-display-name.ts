/**
 * Visitor-facing plat / subdivision name.
 *
 * MLS SubdivisionName is an ingest key. Abbreviations (Oww, DrrhTrs, Bbr,
 * StoneTH, Crr 1) are not place names. Withhold them. Do not invent an
 * expansion.
 *
 * Founding case: /subdivisions/river-meadows More areas printed Oww,
 * DrrhTrs, Drrh Trs, OWW2 (fleet ca552556c46f87dbefdbe4ae948f1b68).
 */

import { displaySubdivision } from '@/lib/slug'

const KNOWN_MLS_ABBREVIATIONS = new Set(
  [
    'oww',
    'oww2',
    'drrhtrs',
    'drrh trs',
    'bbr',
    'stoneth',
    'crr 1',
    'crr1',
    'crr',
  ].map((s) => s.toLowerCase()),
)

function compactLetters(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '')
}

export function looksLikeMlsAbbreviation(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  if (KNOWN_MLS_ABBREVIATIONS.has(trimmed.toLowerCase())) return true
  if (/^[A-Z]{2,5}\d{0,2}$/.test(trimmed)) return true
  if (/^[A-Za-z]{2,4}\s+\d+$/.test(trimmed)) return true
  if (!/\s/.test(trimmed) && trimmed.length <= 8) {
    const vowels = (trimmed.match(/[aeiouAEIOU]/g) ?? []).length
    const hasInternalCap = /[a-z][A-Z]/.test(trimmed)
    if (vowels === 0) return true
    if (hasInternalCap) return true
    if (trimmed.length <= 3 && vowels <= 1) return true
  }
  const compact = compactLetters(trimmed)
  if (compact.length <= 8 && (compact.match(/[aeiouAEIOU]/g) ?? []).length === 0) {
    return true
  }
  return false
}

export function publishPlatDisplayName(raw: string | null | undefined): string | null {
  const cleaned = displaySubdivision(raw)
  if (!cleaned) return null
  if (looksLikeMlsAbbreviation(cleaned)) return null
  return cleaned
}
