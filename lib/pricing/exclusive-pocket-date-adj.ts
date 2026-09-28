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
 * pump (factor > 1 → flat) but allows downward cooling (factor ≤ 1). Size and
 * story stay 0 on the exclusive pocket. Story is killed entirely — even when
 * the pocket is starved and widens one ring.
 */

import type { MarketPath } from '@/lib/pricing/market-path'

/**
 * Geography the picker already refused. City-index lift is the same refuse.
 * `gla-bracket` is a size-bracket substitution from outside the pocket
 * (match.ts bracketGla). It is not an exclusive tier. Ignoring it kept a
 * mixed set labeled exclusive and zeroed the size adjustment the bracket
 * exists to restore.
 */
const WIDEN_TIER = /^(nearby-|city-|similar-|widened-|beyond-|rural-|like-community-|competing-|gla-bracket)/

/** Own street, own plat, or the 0.25 mi street-cluster pocket. */
const EXCLUSIVE_TIER = /^(pocket-|subdivision-|own-street-)/

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

export function selectionIsExclusivePocket(tiersUsed: readonly string[]): boolean {
  if (tiersUsed.some((t) => WIDEN_TIER.test(t))) return false
  return tiersUsed.some((t) => EXCLUSIVE_TIER.test(t))
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
      return `${address}: exclusive pocket — Flex-style cooling date adjustment ${appliedPct}% (city index refused upward pump of ${cityPct}%). Size and story class do not adjust.`
    }
    return `${address}: exclusive pocket — Flex-style cooling date adjustment ${appliedPct}% along the market path. Size and story class do not adjust.`
  }
  if (cityPath.factor > 1) {
    return `${address}: exclusive pocket — date adjustment not applied along the city index (would have pumped ${cityPct}%). Sold and last-ask stay as recorded — size and story class do not adjust.`
  }
  return `${address}: exclusive pocket — date adjustment flat. Sold and last-ask stay as recorded — size and story class do not adjust.`
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
 */
export function describeAppliedDateAdjustments(moves: readonly AppliedDateMove[]): string | null {
  const moved = moves.filter((m) => {
    if (!(m.closePrice > 0) || !Number.isFinite(m.timeAdjustment)) return false
    return Math.abs(m.timeAdjustment) >= DATE_MOVE_MIN_DOLLARS
  })
  if (moved.length === 0) return null
  const bits = moved.map((m) => {
    const to = m.timeAdjustedPrice != null && m.timeAdjustedPrice > 0 ? m.timeAdjustedPrice : m.closePrice + m.timeAdjustment
    const pct = (m.timeAdjustment / m.closePrice) * 100
    const sign = pct > 0 ? '+' : ''
    const where = m.address.trim() || 'one sale'
    return `${where} moved ${sign}${pct.toFixed(1)} percent, from ${usd(m.closePrice)} to ${usd(to)}`
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
    return `These sales are the exclusive pocket. ${detail} The ${place} city index is not used to pump prices. Size and story class do not adjust.`
  }
  if (coolingApplied) {
    return `These sales are the exclusive pocket. Flex-style cooling date adjustment is applied to every sale in this window along the market path. The ${place} city index is not used to pump prices. Size and story class do not adjust.`
  }
  return `These sales are the exclusive pocket. Date adjustment is not applied along the ${place} city index. That series includes tracts already excluded from this set. Each sale stays on its sold and last-ask price. Size and story class do not adjust.`
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
