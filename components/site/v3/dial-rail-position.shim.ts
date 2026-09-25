/**
 * SHIM, DELETE ON MERGE (2026-09-24).
 *
 * Matt's direction for the dial: not every dial is the same interaction. The
 * primitive's owner is adding `railPosition?: 'left' | 'right' | 'bottom'`
 * (default 'bottom') to V3ListingDial and `dialRailPositionAt(index)` to
 * components/site/v3/V3ListingDial.logic.ts, cycling bottom, left, right, so
 * that the dials on one page take positions by their order and no two
 * adjacent dials read as the same object. Neither exists in this branch yet.
 *
 * Every converted page imports the helper and the prop-accepting dial from
 * HERE, so reconciling is one file: point these two exports at the real ones
 * (`dialRailPositionAt` from './V3ListingDial.logic', and V3ListingDial itself
 * once its props carry `railPosition`), or delete this file and repoint the
 * imports. Until then the dial ignores the prop at run time and keeps its own
 * left rail, which is what this branch's screenshots show.
 */
import type { ComponentType } from 'react'
import { V3ListingDial as V3ListingDialPrimitive, type V3ListingDialProps } from './V3ListingDial.client'

export type DialRailPosition = 'left' | 'right' | 'bottom'

const RAIL_CYCLE: readonly DialRailPosition[] = ['bottom', 'left', 'right']

/** The rail position for the dial at `index` in page order: bottom, left, right, bottom, ... */
export function dialRailPositionAt(index: number): DialRailPosition {
  const i = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0
  return RAIL_CYCLE[i % RAIL_CYCLE.length]!
}

/** V3ListingDial with the coming `railPosition` prop in its type. */
export const V3ListingDialRail = V3ListingDialPrimitive as ComponentType<
  V3ListingDialProps & { railPosition?: DialRailPosition }
>
