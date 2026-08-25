/**
 * Public HUD KPI row from leftover membership only (D19).
 * One pile, named window. Miss omits. Pulse and cache never fill these tiles.
 * Pending · now is leftover pending_count. New · 30 days stays omitted until
 * leftover has a 30-day new-listings cell. Do not map 12-month leftover closed
 * onto Closed · 30 days.
 */
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import { publishMonthsOfSupply, type MarketGrain } from '@/lib/market/publish-months-of-supply'

export type LeftoverHudHeadlines = {
  activeCount: number
  monthsOfSupply: number
  medianListPrice: number | null
}

export type LeftoverHudInventory = {
  activeCount: number
  medianListPrice: number | null
}

export type LeftoverHudKpis = {
  active: number | null
  pending: number | null
  closed30: number | null
  new30: number | null
  medianList: number | null
  saleToList: number | null
  daysToPending: number | null
  monthsSupply: number | null
  sold12mo: number | null
}

export function leftoverSaleToListPct(saleToOriginal: number | null | undefined): number | null {
  if (saleToOriginal == null || saleToOriginal <= 0) return null
  return saleToOriginal < 2 ? saleToOriginal * 100 : saleToOriginal
}

export function leftoverHudKpis(input: {
  grain: MarketGrain
  headlines: LeftoverHudHeadlines | null | undefined
  inventory: LeftoverHudInventory | null | undefined
  pace: PublicPaceRow
}): LeftoverHudKpis {
  const headlines = input.headlines ?? null
  const inventory = input.inventory ?? null
  const active = headlines?.activeCount ?? inventory?.activeCount ?? null
  const medianList = headlines?.medianListPrice ?? inventory?.medianListPrice ?? null
  const monthsSupply =
    headlines != null
      ? publishMonthsOfSupply({
          grain: input.grain,
          source: 'market-truth',
          pulseMos: headlines.monthsOfSupply,
          pulseActiveCount: headlines.activeCount,
          displayedActiveCount: active,
        })
      : null

  return {
    active,
    pending: input.pace.pendingCount,
    closed30: input.pace.closedCount30d,
    new30: input.pace.newCount30d ?? null,
    medianList,
    saleToList: leftoverSaleToListPct(input.pace.saleToOriginal),
    daysToPending: input.pace.daysToPending90d,
    monthsSupply,
    sold12mo: input.pace.closedCount,
  }
}

/** True when leftover HUD has a visitor cell at this grain. Miss omits. */
export function leftoverHudPublishes(hud: LeftoverHudKpis | null | undefined): boolean {
  if (!hud) return false
  return (
    hud.active != null ||
    hud.pending != null ||
    hud.closed30 != null ||
    hud.medianList != null ||
    hud.saleToList != null ||
    hud.daysToPending != null ||
    hud.monthsSupply != null
  )
}
