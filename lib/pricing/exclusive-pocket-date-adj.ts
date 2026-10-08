/**
 * Exclusive-pocket date-adjust residual (Canter 2026-09-15 → 2026-09-17).
 *
 * Admin already owns picker exclusivity (SaddleStone / Horse Back / Ranch in;
 * Clearpine / Forest Edge / Grand Peaks out). Do not reopen that path.
 *
 * The city monthly index is every Sisters sale. Walking exclusive-pocket
 * Horse Back closes along a rising city series reintroduces the upmarket
 * ppsf the picker excluded and pumps recommend toward ~$800k+. Flex uses
 * nearer list/sold without that pump.
 *
 * Matt 2026-09-17 Flex-style cool: exclusive pocket refuses upward city-index
 * pump (factor > 1 → flat) but allows downward cooling (factor ≤ 1). Story
 * stays 0 on the exclusive pocket. Story is killed entirely — even when
 * the pocket is starved and widens one ring. Matt 2026-10-08: size adjusts on
 * the pocket too, so the notes below say only that story class does not
 * adjust (lib/pricing/size-adjustment.ts owns the size line).
 */

import type { MarketPath } from '@/lib/pricing/market-path'
import { classifyRungName } from '@/lib/pricing/rung-class'

export const TIME_ADJUSTMENT_MEASURE_POCKET = 'sold and last-ask prices in this exclusive pocket'

export const TIME_ADJUSTMENT_BASIS_POCKET = 'exclusive-pocket-sold-list' as const

/**
 * Matt 2026-09-17 re-anchor: Canter gold bar = live market-cool Rec ~$680
 * (@ 0cccf1ea4). FlexMLS ~$659 RETIRED as Tip Ready refuse bar.
 * Tip Ready: |Recommended − CANTER_GOLD_RECOMMEND| ≤ CANTER_GOLD_TOLERANCE.
 */
export const CANTER_GOLD_RECOMMEND = 680_000
/** Live closed-comp band around the cool Rec (reasonable gate). */
export const CANTER_GOLD_LOW = 675_000
export const CANTER_GOLD_HIGH = 705_000
export const CANTER_GOLD_TOLERANCE = 40_000

/** @deprecated Flex ~$659 retired — aliases to CANTER_GOLD_*. */
export const FLEX_CANTER_RECOMMEND = CANTER_GOLD_RECOMMEND
/** @deprecated use CANTER_GOLD_LOW */
export const FLEX_CANTER_LOW = CANTER_GOLD_LOW
/** @deprecated use CANTER_GOLD_HIGH */
export const FLEX_CANTER_HIGH = CANTER_GOLD_HIGH

/** Retired Flex refuse bar — history only; never Tip Ready refuse. */
export const RETIRED_FLEX_CANTER_RECOMMEND = 659_000

/** Tip Ready: Canter Rec near live gold ~$680. */
export function canterRecommendNearGold(recommended: number): boolean {
  if (!(recommended > 0)) return false
  return Math.abs(recommended - CANTER_GOLD_RECOMMEND) <= CANTER_GOLD_TOLERANCE
}

/** Matt 2026-09-17 — Tip Ready refuse below this many closed comps. */
export const CANTER_MIN_CLOSED_COMPS = 5

/**
 * True only when every rung is the subject's own street, own plat, or the
 * 0.25 mi pocket, and at least one of those is present. Any wider rung,
 * including a name the classifier does not know, keeps size adjustment and
 * the upward date move. `broker-selected` on its own is not exclusive.
 */
export function selectionIsExclusivePocket(tiersUsed: readonly string[]): boolean {
  const classes = tiersUsed.map((tier) => classifyRungName(tier))
  if (classes.some((kind) => kind === 'widen' || kind === 'unclassified')) return false
  return classes.some((kind) => kind === 'exclusive')
}

/**
 * Flex-style time/date on exclusive pocket (market cool / no false hope):
 * allow downward cooling; refuse upward city-index pump.
 */
export function applyExclusivePocketDateAdj(path: MarketPath, exclusivePocket: boolean): MarketPath {
  if (!exclusivePocket) return path
  if (path.factor === 1 && path.source === 'none') return path
  // Cooling or flat — keep Flex-style time adjustment.
  if (path.factor <= 1) return path
  // Rising city index — refuse the pump.
  return {
    ...path,
    factor: 1,
    monthlyRate: 0,
    regime: 'flat',
    capped: true,
  }
}

/**
 * @deprecated Matt 2026-09-17 killed story-adj entirely. Always returns 0.
 * Kept so Tip Ready contracts can assert the refuse still holds if called.
 */
export function applyExclusivePocketStoryAdj(_rawStoryAdj: number, _exclusivePocket: boolean): number {
  return 0
}

export function exclusivePocketPathNote(
  address: string,
  cityPath: MarketPath,
  applied?: MarketPath,
): string {
  const cityPct = ((cityPath.factor - 1) * 100).toFixed(1)
  const used = applied ?? (cityPath.factor <= 1 ? cityPath : { ...cityPath, factor: 1 })
  if (used.factor < 1) {
    const appliedPct = ((used.factor - 1) * 100).toFixed(1)
    if (cityPath.factor > 1) {
      return `${address}: exclusive pocket — Flex-style cooling date adjustment ${appliedPct}% (city index refused upward pump of ${cityPct}%). Story class does not adjust.`
    }
    return `${address}: exclusive pocket — Flex-style cooling date adjustment ${appliedPct}% along the market path. Story class does not adjust.`
  }
  if (cityPath.factor > 1) {
    return `${address}: exclusive pocket — date adjustment not applied along the city index (would have pumped ${cityPct}%). No date move. Story class does not adjust.`
  }
  return `${address}: exclusive pocket — date adjustment flat. No date move. Story class does not adjust.`
}

/** One closed sale the date adjustment did or did not move. */
export type AppliedDateMove = {
  address: string
  closePrice: number
  timeAdjustment: number
  timeAdjustedPrice?: number | null
}

const DATE_MOVE_MIN_DOLLARS = 500

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * The sentence for the moves that were actually applied. Null when nothing
 * moved. Names the percentage and the comps, so a grid that walked a sale
 * from $621,000 to $594,000 cannot sit under a line that says no date
 * adjustment was applied.
 *
 * EVERY "MOVED X PERCENT, FROM A TO B" IS TRUE OF A AND B (reader review,
 * 2382 Jackson, 2026-10-07). The date move starts from the sale price after
 * a recorded seller concession (comparisonSalePrice), and `timeAdjustedPrice`
 * is that start plus the date move. The line used to print the date move as a
 * share of the CLOSE and run it from the close to the post-concession price:
 * "2266 Jackson moved -8.1 percent, from $690,000 to $619,448", where
 * $690,000 to $619,448 is really -10.2 percent and the date move alone is
 * -8.2 percent of $675,000. Now the percent is the date move over the price
 * it moved from, the "from" is that price, and a concession that came off
 * first is named with the close it came off.
 */
export function describeAppliedDateAdjustments(moves: readonly AppliedDateMove[]): string | null {
  const moved = moves.filter((m) => {
    if (!(m.closePrice > 0) || !Number.isFinite(m.timeAdjustment)) return false
    return Math.abs(m.timeAdjustment) >= DATE_MOVE_MIN_DOLLARS
  })
  if (moved.length === 0) return null
  const bits = moved.map((m) => {
    const hasTo = m.timeAdjustedPrice != null && Number.isFinite(m.timeAdjustedPrice) && m.timeAdjustedPrice > 0
    // The price the date move started from: the close, less any recorded
    // seller concession. Read back off the stored pair so the line and the
    // grid can never disagree about it.
    const from = hasTo ? Math.round((m.timeAdjustedPrice as number) - m.timeAdjustment) : m.closePrice
    const to = hasTo ? (m.timeAdjustedPrice as number) : m.closePrice + m.timeAdjustment
    const base = from > 0 ? from : m.closePrice
    const pct = (m.timeAdjustment / base) * 100
    const sign = pct > 0 ? '+' : ''
    const where = m.address.trim() || 'one sale'
    const concession = Math.round(m.closePrice - base)
    const move = `${where} moved ${sign}${pct.toFixed(1)} percent for date, from ${usd(base)} to ${usd(to)}`
    return concession >= 1
      ? `${move}, after ${usd(concession)} in seller concessions came off its ${usd(m.closePrice)} sale`
      : move
  })
  const head =
    moved.length === 1
      ? 'Date adjustment was applied to one sale.'
      : `Date adjustment was applied to ${moved.length} sales.`
  return `${head} ${bits.join('; ')}.`
}

/**
 * Set-level note. Must match the math: when sales were cooled, name those
 * sales and the percentage. When nothing moved, say the city index was not
 * used to pump and each sale stays on its sold price.
 */
export function exclusivePocketSetNote(
  city: string,
  coolingApplied: boolean,
  applied?: readonly AppliedDateMove[],
): string {
  const place = (city ?? '').trim() || 'this city'
  const detail = describeAppliedDateAdjustments(applied ?? [])
  if (coolingApplied && detail) {
    return `These sales are the exclusive pocket. ${detail} The ${place} city index is not used to pump prices. Story class does not adjust.`
  }
  if (coolingApplied) {
    return `These sales are the exclusive pocket. Flex-style cooling date adjustment is applied to every sale in this window along the market path. The ${place} city index is not used to pump prices. Story class does not adjust.`
  }
  return `These sales are the exclusive pocket. Date adjustment is not applied along the ${place} city index. That series includes tracts already excluded from this set. No sale is moved for the month it sold. Story class does not adjust.`
}

/**
 * A cooled exclusive-pocket band may not sit below every meaningful
 * same-subdivision adjusted sale. The floor is that adjusted price, never
 * the unadjusted close: lifting to the raw close puts a cooled top-weight
 * sale (Slate Rolen, $594k) outside the band it should anchor.
 *
 * When `sameSubdivisionAdjustedPrices` is passed, raw closes are ignored.
 * An empty adjusted list means there is no same-subdivision floor.
 */
export function floorExclusivePocketBandToSameSubCloses(args: {
  valueLow: number
  valueHigh: number
  sameSubdivisionClosePrices: readonly number[]
  sameSubdivisionAdjustedPrices?: readonly number[]
  coolingApplied: boolean
}): { valueLow: number; valueHigh: number; floored: boolean; floor: number | null } {
  const low = Math.min(args.valueLow, args.valueHigh)
  const high = Math.max(args.valueLow, args.valueHigh)
  const adjusted =
    args.sameSubdivisionAdjustedPrices?.filter((n) => Number.isFinite(n) && n > 0) ?? null
  const closes =
    adjusted != null
      ? adjusted
      : args.sameSubdivisionClosePrices.filter((n) => Number.isFinite(n) && n > 0)
  if (!args.coolingApplied || closes.length === 0) {
    return { valueLow: low, valueHigh: high, floored: false, floor: null }
  }
  const floor = Math.min(...closes)
  // Never lift the low above a meaningful same-subdivision adjusted sale.
  // The floor is the lowest of those sales, so a band that already includes
  // one stays where the adjustment put it.
  if (low >= floor) return { valueLow: low, valueHigh: high, floored: false, floor }
  return { valueLow: floor, valueHigh: Math.max(floor, high), floored: true, floor }
}
