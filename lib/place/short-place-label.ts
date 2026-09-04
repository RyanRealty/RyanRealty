/**
 * Plat legal names are long. The map and chips print a short door, not the
 * county plat line. Empty after stripping falls back to the original.
 */
export function shortPlaceLabel(name: string): string {
  const raw = name.trim()
  if (!raw) return raw
  let s = raw
  s = s.replace(/\s*phases?\s+\d+(?:\s*(?:and|&)\s*\d+)*/gi, '')
  s = s.replace(/\s*sub(?:division)?[-.\s]+\d{1,2}(?:[-.\s]\d{2,})+/gi, '')
  s = s.replace(/\s+addition to\s+.+$/i, ' Addition')
  s = s.replace(/\s*,\s*$/g, '')
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s || raw
}
