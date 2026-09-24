/**
 * SHIM, REMOVE AT MERGE (SITE-193, 2026-09-24).
 *
 * Matt 2026-09-24: not every dial on a page is the same interaction. The dial
 * primitive gains `railPosition?: 'left' | 'right' | 'bottom'` (default
 * 'bottom') and `dialRailPositionAt(index)` in V3ListingDial.logic.ts, which
 * cycles bottom, left, right, so adjacent dials on one page differ. Both are
 * being added by the agent that owns V3ListingDial.*; this branch does not
 * touch those files. Until they land, this file carries the same helper so
 * the place pages that stack several dials (PlaceSubdivisionHomes,
 * V3PlaceInventory) can pass it and compile.
 *
 * AT MERGE: import { dialRailPositionAt } from './V3ListingDial.logic' in
 * PlaceSubdivisionMap.client.tsx and V3PlaceInventory.tsx, drop the
 * `@ts-expect-error` above each `railPosition` (tsc reports them as unused
 * once the prop exists), and delete this file.
 */
export type DialRailPosition = 'left' | 'right' | 'bottom'

const RAIL_CYCLE: readonly DialRailPosition[] = ['bottom', 'left', 'right']

/** The rail position of the dial at this order on the page: bottom, left, right, bottom, ... */
export function dialRailPositionAt(index: number): DialRailPosition {
  const n = Number.isFinite(index) ? Math.trunc(index) : 0
  return RAIL_CYCLE[((n % RAIL_CYCLE.length) + RAIL_CYCLE.length) % RAIL_CYCLE.length]!
}
