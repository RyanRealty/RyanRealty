/**
 * Which drawn places on the Atlas are DOORS — polygons a visitor can tab to,
 * press or click — and the accessible name each door carries.
 *
 * THE INVARIANT (WCAG 2.5.8 Target Size, the "Equivalent" exception; held at
 * runtime by ci:tap-targets, scripts/check-tap-targets.mjs): most place
 * polygons are far under 44x44 CSS px on a phone, and on a city map a
 * district can draw at 9px. A small polygon is only a conforming target when
 * a full-size control on the same page does the same job and carries the
 * same name. So a polygon is a door exactly when that partner exists, and it
 * takes its name from the partner:
 *
 *   · Paired map (a place rail beside it, PlaceSubdivisionMap): the partner
 *     is the child's rail row. The door's name is the rail row's own name,
 *     verbatim, so the two can never disagree. Before this, the polygon took
 *     the chip-style door label: of the 60 plats /cities/redmond draws
 *     (getCommunitySubdivisions, read 2026-10-07), 17 polygons read a label
 *     their rail row did not ("Hearthstone" beside "Hearthstone Phase 1"),
 *     so neither could stand for the other. A place the rail does not list,
 *     and any non-child place, is drawn but is not a control.
 *   · Every other map: the partner is the place's chip in the reach list. A
 *     place with no chip (no publishable name, or a read that came back
 *     short and printed no chips) is drawn but is not a control.
 *
 * What this replaced (CI, 2026-10-07): every drawn polygon was a
 * role="button" while the chips and the rail rows were each decided on their
 * own rules, so a polygon could be a control with no partner. The failure
 * that surfaced it was the rail's fold hiding rows out of reach of "Show
 * all" (lib/place/rail-fold.ts). Here the partner decides, and nothing else.
 *
 * Pure; the component runs it once per data set.
 */
import { childSelectionId } from '@/lib/place/map-hierarchy'

export type AtlasDoorPlace = { id: string }

export type AtlasDoorInput<S extends AtlasDoorPlace> = {
  /** The polygons the map draws, in paint order. */
  drawn: readonly S[]
  /**
   * Paired selection only: the child place ids, and the rail's own row name
   * for each child keyed by its selection id (childSelectionId, the rail
   * row's id). Null or absent: the map is not paired.
   */
  paired?: {
    childIds: ReadonlySet<string>
    railNames: Readonly<Record<string, string>>
  } | null
  /** Unpaired only: the places the reach list renders a chip for. */
  chips: readonly S[]
  /** The label a chip prints for a place (the door label). */
  chipLabel: (place: S) => string
}

/** The rail's lookup key for a child shape id: its selection id, lower-cased. */
export function atlasDoorKey(shapeId: string): string {
  return childSelectionId(shapeId).trim().toLowerCase()
}

/**
 * Door name per drawn place id. A place absent from the map is not a door.
 * Every name is non-empty: a control without a name is never handed out.
 */
export function atlasPlaceDoors<S extends AtlasDoorPlace>(input: AtlasDoorInput<S>): Map<string, string> {
  const doors = new Map<string, string>()
  const { drawn, paired, chips, chipLabel } = input
  if (paired) {
    const byKey = new Map<string, string>()
    for (const [id, name] of Object.entries(paired.railNames)) {
      const key = id.trim().toLowerCase()
      const label = name.trim()
      if (key && label && !byKey.has(key)) byKey.set(key, label)
    }
    for (const place of drawn) {
      if (!paired.childIds.has(place.id)) continue
      const name = byKey.get(atlasDoorKey(place.id))
      if (name) doors.set(place.id, name)
    }
    return doors
  }
  const chipIds = new Set(chips.map((chip) => chip.id))
  for (const place of drawn) {
    if (!chipIds.has(place.id)) continue
    const name = chipLabel(place).trim()
    if (name) doors.set(place.id, name)
  }
  return doors
}

/**
 * The paint indices that are doors, in order: the map's one tab stop and its
 * arrow keys walk these and nothing else.
 */
export function atlasDoorIndices<S extends AtlasDoorPlace>(
  drawn: readonly S[],
  doors: ReadonlyMap<string, string>,
): number[] {
  const out: number[] = []
  drawn.forEach((place, i) => {
    if (doors.has(place.id)) out.push(i)
  })
  return out
}

/**
 * The door an arrow, Home or End key moves to from the door at paint index
 * `from`. Wraps at both ends. -1 when the map has no door.
 */
export function atlasNextDoor(
  doorIndices: readonly number[],
  from: number,
  key: 'next' | 'prev' | 'first' | 'last',
): number {
  const n = doorIndices.length
  if (n === 0) return -1
  if (key === 'first') return doorIndices[0]!
  if (key === 'last') return doorIndices[n - 1]!
  const at = doorIndices.indexOf(from)
  if (at < 0) return doorIndices[0]!
  const step = key === 'next' ? 1 : -1
  return doorIndices[(at + step + n) % n]!
}
