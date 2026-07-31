/**
 * area-picker — pure helpers behind the in-map named-area control
 * (SEARCH_OPTIMIZATION_PLAN_2026-07-29 §4 Phase 2.4, the last open item:
 * "no way to pick a saved area from inside the map surface").
 *
 * Client-safe and pure. No server imports, no React. The component
 * (AreaPicker.tsx) owns the fetching and the markup, this module owns the
 * contract:
 *
 *   1. A saved area's DB shapes ([lng,lat] tuples) become DrawnShape[] —
 *      the exact same value a hand-drawn shape produces — so applying an
 *      area rides the existing `?shapes=` URL contract and is shareable and
 *      alert-savable with no new plumbing.
 *   2. Applying ROUND-TRIPS through the URL grammar (encode → decode) before
 *      it reaches the map, so the live search state and the shared link are
 *      byte-identical. Without this, an area denser than MAX_POINTS (80
 *      vertices) or wider than MAX_SHAPES would search at full fidelity
 *      locally while the shared URL searched a simplified version — two
 *      different result sets behind one link.
 *   3. The active-area readout is derived, never stored: an area is "on"
 *      when its encoded signature equals the map's current encoded
 *      signature. That survives reload with no extra URL param, because
 *      both sides run through encodeMapShapes.
 */

import {
  decodeMapShapes,
  encodeMapShapes,
  type DrawnShape,
} from '@/lib/map-polygon'
import { areaShapesToDrawnShapes } from '@/lib/search/area-link'
import type { AreaShape } from '@/lib/data/areas/validation'

/** Where a picker row came from: the signed-in user, or a published area. */
export type PickerAreaScope = 'mine' | 'shared'

/** One row in the picker. Mirrors the server action's payload. */
export type PickerArea = {
  id: string
  name: string
  slug: string | null
  shapes: AreaShape[]
  scope: PickerAreaScope
}

/**
 * The canonical signature of a drawn shape set: its `?shapes=` encoding.
 * Null when nothing encodable remains (empty set, degenerate shapes).
 */
export function shapeSetSignature(shapes: DrawnShape[] | null | undefined): string | null {
  if (!shapes || shapes.length === 0) return null
  return encodeMapShapes(shapes) ?? null
}

/**
 * A saved area as the map should hold it: DrawnShape[], every shape stamped
 * with the area's name so the on-map pills read "Bend west side" instead of
 * "Area 1", and simplified to exactly what the URL can carry (see the module
 * note). Returns [] when the area has no encodable include shape, which the
 * caller must treat as "not applicable" rather than "search everything".
 */
export function drawnShapesForArea(area: Pick<PickerArea, 'name' | 'shapes'>): DrawnShape[] {
  const drawn = areaShapesToDrawnShapes(area.shapes ?? [])
  if (!drawn.some((s) => !s.exclude)) return []
  const encoded = encodeMapShapes(drawn)
  if (!encoded) return []
  const roundTripped = decodeMapShapes(encoded)
  if (!roundTripped || roundTripped.length === 0) return []
  return roundTripped.map((shape) => ({ ...shape, name: area.name }))
}

/**
 * Which saved area (if any) the map is currently showing. Compares encoded
 * signatures, so a reloaded `?shapes=` URL still resolves to its area.
 * Returns the FIRST match — ids are unique but two areas may hold identical
 * geometry, and either name is equally true.
 */
export function matchActiveArea(
  areas: PickerArea[],
  current: DrawnShape[] | null | undefined,
): PickerArea | null {
  const signature = shapeSetSignature(current)
  if (!signature) return null
  for (const area of areas) {
    if (shapeSetSignature(drawnShapesForArea(area)) === signature) return area
  }
  return null
}

/** Count of include shapes (excludes never widen a search). */
export function includeShapeCount(shapes: DrawnShape[] | null | undefined): number {
  return (shapes ?? []).filter((s) => !s.exclude).length
}

/** "3 areas" / "1 area" — the picker's plural-safe count label. */
export function areaCountLabel(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'area' : 'areas'}`
}
