/**
 * The place rail's fold and the names it lends the map (PlaceSubdivisionMap).
 *
 * The rail beside a paired Atlas is the full-size partner of every child
 * polygon: a district on /cities/bend can draw at 9px, and WCAG 2.5.8
 * Equivalent (held by ci:tap-targets) accepts it only because a 44px row
 * doing the same job, with the same name, is on the page. Two rules keep
 * that true for every place, and both live here so they can be tested
 * without a browser:
 *
 *   1. railFold: every row is at rest or in the ONE folded list "Show all"
 *      opens. Never a row hidden on its own, which nothing ties to a trigger
 *      (CI 2026-10-07: Southern Crossing, Southwest Bend and Summit West, the
 *      rows past the fold, lost their partner and the gate went red).
 *   2. railDoorNames: the name each row's button carries, keyed by row id,
 *      which the map gives the matching polygon verbatim
 *      (lib/atlas/atlas-doors.ts).
 */
import type { SubdivisionRailEntry } from '@/lib/place/place-child-stock'

/** Rows the rail shows before "Show all" (Matt 2026-10-04). */
export const RAIL_FOLD_AT = 10

/**
 * Which rail rows render at rest and which sit in the folded list "Show all"
 * opens. Every row lands in exactly one of the two, in rail order. The row
 * the map selected stays at rest while the fold is closed, so a polygon
 * click never selects an invisible row.
 */
export function railFold<T extends { id: string }>(
  rail: readonly T[],
  state: { open: boolean; selectedId: string | null },
): { atRest: T[]; folded: T[] } {
  if (rail.length <= RAIL_FOLD_AT) return { atRest: [...rail], folded: [] }
  const head = rail.slice(0, RAIL_FOLD_AT)
  const tail = rail.slice(RAIL_FOLD_AT)
  if (state.open || state.selectedId == null) return { atRest: head, folded: tail }
  const pinned = tail.find((entry) => entry.id === state.selectedId)
  if (!pinned) return { atRest: head, folded: tail }
  return { atRest: [...head, pinned], folded: tail.filter((entry) => entry !== pinned) }
}

/**
 * The map's door names, keyed by rail row id (lower-cased): exactly the name
 * each row's button carries as its accessible name. The first row for an id
 * wins, as it does in the rail.
 */
export function railDoorNames(
  rail: readonly Pick<SubdivisionRailEntry, 'id' | 'name'>[],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const entry of rail) {
    const key = entry.id.trim().toLowerCase()
    if (key && !(key in out)) out[key] = entry.name
  }
  return out
}
