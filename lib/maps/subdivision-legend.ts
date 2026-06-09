/**
 * Subdivision legend for a boundary map. Given the map pins (each optionally
 * tagged with its subdivision), return the distinct subdivisions worth showing as
 * hoverable chips — those with at least `minCount` homes, the top `max` by count.
 *
 * Per-subdivision POLYGON boundaries don't exist in the `boundaries` table (and
 * can't be generated — CLAUDE.md GIS rule), so hovering a subdivision highlights
 * its HOMES (pins), not a polygon. This is the data behind that legend.
 */

export type PinLike = { subdivisionName?: string | null }

export type SubdivisionLegendEntry = { name: string; count: number }

export function subdivisionLegend(
  pins: ReadonlyArray<PinLike>,
  opts?: { minCount?: number; max?: number },
): SubdivisionLegendEntry[] {
  const minCount = opts?.minCount ?? 2
  const max = opts?.max ?? 8
  const counts = new Map<string, number>()
  for (const p of pins) {
    const name = p.subdivisionName?.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((e) => e.count >= minCount)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, max)
}
