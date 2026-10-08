/**
 * ONE SET OF NUMBERS, AND THE DATE STORY IS THE GRID'S (reader review,
 * 62475 Woodsman, 2026-10-08).
 *
 * This module used to take a date cut back out of the printed grid when the
 * local price per square foot held flat, and leave everything else alone. But
 * the band, the set-aside, the weights, the cover sentence and the
 * reconciliation are all computed on the date-moved prices (lib/pricing/
 * estimate.ts reads `adjustedPrice`, which carries the date move). The letter
 * then printed a low of $1,359,694 that sat in no table, named 62637 Mt Hood
 * "lowest of the adjusted sales" over a grid that printed it above 62667
 * Ember, and printed a 9.2 percent gross beside a -2.4 percent net. A renderer
 * cannot undo an adjustment the price was built on, so it no longer tries:
 * the grid prints the priced set, the date move on its own row.
 *
 * The flat local story stays, and prints only when it is true of the grid: the
 * price per square foot held flat AND no printed sale was moved for the month
 * it closed.
 */

import type { CmaPricing } from '@/lib/cma/types'

/** A date move under a dollar is rounding, not a move (the grid's own test). */
const DATE_MOVE_MIN_DOLLARS = 1

export const FLAT_LOCAL_DATE_SENTENCE =
  'The price per square foot held flat while your home was listed, so no sale is moved for the month it closed.'

/** True when at least one of these sales carries a date move of a dollar or more. */
export function anySaleMovedForDate(comps: readonly { timeAdjustment?: number | null }[]): boolean {
  return comps.some((c) => Math.abs(c.timeAdjustment ?? 0) >= DATE_MOVE_MIN_DOLLARS)
}

/**
 * The flat local story holds: the local price per square foot held flat and
 * no sale in the grid was moved for date. A date move that ran is printed in
 * the grid and named in the method, never written over.
 */
export function flatLocalDateStory(args: {
  ppsfMove: string | null | undefined
  comps: readonly { timeAdjustment?: number | null }[]
}): boolean {
  if (args.ppsfMove !== 'held flat') return false
  if (args.comps.length === 0) return false
  return !anySaleMovedForDate(args.comps)
}

/**
 * The pricing with the flat local date sentence. Only the sentence changes:
 * no sale moved, so no price, band or weight has anything to give back.
 */
export function withFlatLocalDateStory<P extends CmaPricing>(pricing: P): P {
  const time = pricing.timeAdjustment
  if (!time) return pricing
  return { ...pricing, timeAdjustment: { ...time, sentence: FLAT_LOCAL_DATE_SENTENCE } }
}
