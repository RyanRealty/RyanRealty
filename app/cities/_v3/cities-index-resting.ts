/**
 * Resting-state copy for a cities-index row (SITE-69).
 *
 * When Market Truth published a months-of-supply reading, that verdict sits on
 * the row at rest. The navy monogram itself is the resting mark when there is
 * no photo — do not print production language on the face of the page.
 */

/**
 * One leftover active count for a city row (leftoverHudKpis order).
 * Headlines, then inventory, then the snapshot, then the index row.
 * Never mix a region leftover into a city rest panel (SITE-92 Mini: 648 vs 29).
 */
export function cityLeftoverActive(input: {
  headlinesActive?: number | null
  inventoryActive?: number | null
  snapshotActive?: number | null
  indexActive?: number | null
}): number | null {
  const leftover = input.headlinesActive ?? input.inventoryActive
  if (leftover != null && Number.isFinite(leftover)) return leftover
  if (input.snapshotActive != null && Number.isFinite(input.snapshotActive)) return input.snapshotActive
  if (input.indexActive != null && Number.isFinite(input.indexActive)) return input.indexActive
  return null
}

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
