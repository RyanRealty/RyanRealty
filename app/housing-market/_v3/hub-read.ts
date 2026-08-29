/**
 * Route-local aliases over the HUD / monthly readers. The public face must
 * not print leftover labels; this file is the only hub module allowed to
 * name those readers.
 */
import {
  leftoverOrCacheMonthly,
  type PublicMonthlyPoint,
} from '@/lib/data/market-truth/public-monthly'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import {
  leftoverHudKpis,
  type LeftoverHudHeadlines,
  type LeftoverHudInventory,
} from '@/lib/market/publish-leftover-hud'
import type { MarketGrain } from '@/lib/market/publish-months-of-supply'

export function hubHudKpis(input: {
  grain: MarketGrain
  headlines: LeftoverHudHeadlines | null | undefined
  inventory: LeftoverHudInventory | null | undefined
  pace: PublicPaceRow
}) {
  return leftoverHudKpis(input)
}

export function hubMonthlySeries<T extends { periodStart: string; medianSalePrice: number | null }>(
  overlay: readonly PublicMonthlyPoint[],
  cache: readonly T[],
) {
  return leftoverOrCacheMonthly(overlay, cache)
}
