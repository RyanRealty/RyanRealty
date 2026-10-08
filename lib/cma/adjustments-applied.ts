/**
 * WHICH ADJUSTMENTS THE PRINTED SALES CARRY, read once, off the sales.
 *
 * The letter names the adjustments it made in several places: the cover's
 * label over the sold pair, the chart label on chapter 1, the expected-sale
 * paragraph, the grid's last row, the "Condition was not adjusted for" note
 * and the basis paragraph. They were each read by their own helper, and they
 * disagreed with the grid (reader review, 2026-10-08):
 *
 *  - 3177 Coho: two sales carry a seller concession that the grid takes off
 *    on its "Adjusted for seller concessions" row, and every one of those
 *    places said "adjusted for date and size".
 *  - 3037 Purcell: no sale is moved for date (own-ground local read held), and
 *    the cover read "Where similar homes sold, adjusted to today" over a grid
 *    whose last row was "Sale price today".
 *
 * One reader, with the same test the grid's cells pass: a move counts when
 * its cell prints at least a dollar. A date move of +$0.21 prints "$0"
 * (usdSigned), so it is not a date move a sentence may name.
 */

import { concessionOffClose } from '@/lib/pricing/seller-net'
import type { CmaAdjustedComp } from '@/lib/cma/types'

export type AppliedAdjustment = 'date' | 'size' | 'style' | 'concessions'

/** True when the grid prints this move as at least one dollar, either way. */
export function movesADollar(v: number | null | undefined): boolean {
  return v != null && Number.isFinite(v) && Math.abs(v) >= 0.5
}

/** True when at least one of these sales moved for date by a printed dollar. */
export function anySaleMovedForDate(comps: readonly CmaAdjustedComp[] | null | undefined): boolean {
  return (comps ?? []).some((c) => movesADollar(c.timeAdjustment))
}

/**
 * The adjustments at least one of these sales carries, in the order the
 * letter names them: date, size, style, then seller concessions.
 */
export function adjustmentsApplied(comps: readonly CmaAdjustedComp[] | null | undefined): AppliedAdjustment[] {
  const rows = comps ?? []
  const made: AppliedAdjustment[] = []
  if (rows.some((c) => movesADollar(c.timeAdjustment))) made.push('date')
  if (rows.some((c) => movesADollar(c.sizeAdjustment))) made.push('size')
  if (rows.some((c) => movesADollar(c.storyAdjustment))) made.push('style')
  if (rows.some((c) => movesADollar(concessionOffClose(c)))) made.push('concessions')
  return made
}

/** "date, size and seller concessions": each adjustment by the grid row's own name. */
export function adjustmentNouns(made: readonly AppliedAdjustment[]): string[] {
  return made.map((m) => (m === 'concessions' ? 'seller concessions' : m))
}

export function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
