/**
 * Resting-state copy for a cities-index row (SITE-69).
 *
 * When Market Truth published a months-of-supply reading, that verdict sits on
 * the row at rest. The navy monogram itself is the resting mark when there is
 * no photo — do not print production language on the face of the page.
 */

export function restingCityDetail(input: {
  medianLine: string | null
  sentence: string | null
  hasPhoto: boolean
  restingSupply: string | null
}): string | null {
  const bits: string[] = []
  if (input.medianLine) bits.push(input.medianLine)
  if (input.restingSupply) bits.push(input.restingSupply)
  if (input.sentence) bits.push(input.sentence)
  return bits.length > 0 ? bits.join(' · ') : null
}
