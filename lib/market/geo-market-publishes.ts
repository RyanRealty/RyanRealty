/**
 * Whether a /housing-market/[city]/[slug] (or one-segment city) page publishes.
 *
 * Copied from app/housing-market/[...slug]/page.tsx loadGeoMarket: leftover HUD
 * at city or neighborhood grain, or leftover monthly that leftoverOrCacheMonthly
 * will plot. Subdivision grain never has leftover HUD on that route
 * (leftoverGeo is null), so a plat report never publishes.
 */
import type { PublicMonthlyPoint } from '@/lib/data/market-truth/public-monthly'
import { leftoverOrCacheMonthly } from '@/lib/data/market-truth/public-monthly'
import { leftoverHudPublishes, type LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'

export type GeoMarketType = 'city' | 'neighborhood' | 'subdivision'

/** Same leftover grain the market catch-all uses to load HUD and leftover monthly. */
export function geoMarketLeftoverGrain(geoType: GeoMarketType): 'city' | 'neighborhood' | null {
  return geoType === 'neighborhood' || geoType === 'city' ? geoType : null
}

/** Same boolean loadGeoMarket uses before notFound(). */
export function geoMarketPublishes(
  hud: LeftoverHudKpis | null | undefined,
  leftoverMonthly: readonly PublicMonthlyPoint[],
  cacheMonthly: ReadonlyArray<{ periodStart: string; medianSalePrice: number | null }> = [],
): boolean {
  const chartMonths = leftoverOrCacheMonthly(leftoverMonthly, cacheMonthly)
  return leftoverHudPublishes(hud) || chartMonths.months.length > 0
}
