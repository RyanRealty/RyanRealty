/**
 * Exclusive-pocket date-adjust residual (Canter 2026-09-15 → 2026-09-17).
 *
 * Admin already owns picker exclusivity (SaddleStone / Horse Back / Ranch in;
 * Clearpine / Forest Edge / Grand Peaks out). Do not reopen that path.
 *
 * The city monthly index is every Sisters sale. Walking exclusive-pocket
 * Horse Back closes along that series reintroduces the upmarket ppsf the
 * picker excluded and pumps recommend from the Flex ~$649–675k sold/list
 * band toward ~$800k+. Flex uses nearer list/sold without that pump.
 *
 * When the selected set stayed exclusive, date-adjust does not apply the
 * city-index factor. Size still runs. Story adjustment is killed entirely
 * (Matt 2026-09-17) — even when the pocket is starved and widens one ring.
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
 * Exclusive-pocket sales are the market. The city path may still be computed
 * (so the document can name what it refused) but the applied factor is 1.
 */
export function applyExclusivePocketDateAdj(path: MarketPath, exclusivePocket: boolean): MarketPath {
  if (!exclusivePocket) return path
  if (path.factor === 1 && path.source === 'none') return path
  return {
    ...path,
    factor: 1,
    monthlyRate: 0,
    regime: 'flat',
    capped: path.factor !== 1,
  }
}

/**
 * @deprecated Matt 2026-09-17 killed story-adj entirely. Always returns 0.
 * Kept so Tip Ready contracts can assert the refuse still holds if called.
 */
export function applyExclusivePocketStoryAdj(_rawStoryAdj: number, _exclusivePocket: boolean): number {
  return 0
}

export function exclusivePocketPathNote(address: string, cityPath: MarketPath): string {
  const pct = ((cityPath.factor - 1) * 100).toFixed(1)
  return `${address}: exclusive pocket — date adjustment not applied along the city index (would have been ${pct}%). Sold and last-ask stay as recorded; size still adjusts; story class does not.`
}
