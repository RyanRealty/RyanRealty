/**
 * Content-engine city market band from leftover membership.
 * Miss omits. Pulse does not fill.
 */
import type { AreaMarket } from '@/lib/area-market'
import { leftoverHudKpis, leftoverHudPublishes } from '@/lib/market/publish-leftover-hud'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { cityDetachedSlug, getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'

export async function leftoverCityAreaMarket(args: {
  cityName: string
  geoSlug: string
}): Promise<AreaMarket | null> {
  const geoSlug = cityDetachedSlug(canonicalCityCacheSlug(args.geoSlug))
  if (!geoSlug) return null
  const [overlays, pace] = await Promise.all([
    getDetachedOverlays([{ geoType: 'city', geoSlug }]).catch(() => new Map()),
    getPublicDetachedPace({ geoType: 'city', geoSlug }).catch(() => EMPTY_PUBLIC_PACE),
  ])
  const layers = overlays.get(`city:${geoSlug}`)
  const hud = leftoverHudKpis({
    grain: 'city',
    headlines: layers?.headlines ?? null,
    inventory: layers?.inventory ?? null,
    pace: pace ?? EMPTY_PUBLIC_PACE,
  })
  if (
    !leftoverHudPublishes(hud) ||
    (hud.active == null &&
      hud.medianList == null &&
      hud.monthsSupply == null &&
      hud.daysToPending == null)
  ) {
    return null
  }
  return {
    city: args.cityName,
    medianListPrice: hud.medianList,
    activeCount: hud.active,
    monthsOfSupply: hud.monthsSupply,
    medianDaysToPending: hud.daysToPending,
  }
}
