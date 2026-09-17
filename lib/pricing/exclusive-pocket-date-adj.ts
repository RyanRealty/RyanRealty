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

/** Geography the picker already refused. City-index lift is the same refuse. */
const WIDEN_TIER = /^(nearby-|city-|similar-|widened-|beyond-|rural-|like-community-|competing-)/

/** Own street, own plat, or the 0.25 mi street-cluster pocket. */
const EXCLUSIVE_TIER = /^(pocket-|subdivision-|own-street-)/

export const TIME_ADJUSTMENT_MEASURE_POCKET = 'sold and last-ask prices in this exclusive pocket'

export const TIME_ADJUSTMENT_BASIS_POCKET = 'exclusive-pocket-sold-list' as const

/** Matt 2026-09-17 gold gate — Canter recommend must sit near FlexMLS ~$659k. */
export const FLEX_CANTER_RECOMMEND = 659_000
export const FLEX_CANTER_LOW = 649_000
export const FLEX_CANTER_HIGH = 675_000

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
