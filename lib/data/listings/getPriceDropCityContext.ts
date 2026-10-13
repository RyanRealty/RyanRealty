/**
 * City context for the /price-drops/[city] answer block.
 *
 * Composes Market Truth leftover HUD + public detached pace. Does not
 * aggregate raw listings. Per docs/DATABASE_FOR_AI_AGENTS.md §0 / §3.
 */

import { cityDetachedSlug, getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import type { PriceDropCityContext } from '@/lib/price-drops/copy'

export type PriceDropCityContextResult = PriceDropCityContext & {
  degraded: boolean
}

export async function getPriceDropCityContext(citySlug: string): Promise<PriceDropCityContextResult> {
  const geoSlug = cityDetachedSlug(citySlug)
  if (!geoSlug) {
    return {
      monthsOfSupply: null,
      priceCutShare: null,
      medianPriceCut: null,
      saleToOriginal: null,
      daysToPending: null,
      asOf: null,
      degraded: false,
    }
  }

  try {
    const [overlays, pace] = await Promise.all([
      getDetachedOverlays([{ geoType: 'city', geoSlug }]),
      getPublicDetachedPace({ geoType: 'city', geoSlug }),
    ])
    const overlay = overlays.get(`city:${geoSlug}`) ?? null
    const hud = leftoverHudKpis({
      grain: 'city',
      headlines: overlay?.headlines ?? null,
      inventory: overlay?.inventory ?? null,
      pace: pace ?? EMPTY_PUBLIC_PACE,
    })
    return {
      monthsOfSupply: hud.monthsSupply,
      priceCutShare: pace?.priceCutShare ?? null,
      medianPriceCut: pace?.medianPriceCut ?? null,
      saleToOriginal: pace?.saleToOriginal ?? null,
      daysToPending: hud.daysToPending ?? pace?.daysToPending90d ?? null,
      asOf: overlay?.headlines?.computedAt ?? overlay?.inventory?.computedAt ?? null,
      degraded: false,
    }
  } catch (err) {
    console.error('[getPriceDropCityContext]', err)
    return {
      monthsOfSupply: null,
      priceCutShare: null,
      medianPriceCut: null,
      saleToOriginal: null,
      daysToPending: null,
      asOf: null,
      degraded: true,
    }
  }
}
