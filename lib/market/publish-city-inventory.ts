/**
 * City-page inventory count vs the `#homes` tile list.
 *
 * `market_pulse_live.active_listings` is the city pulse (R-020: never invent
 * a count from an empty fetch). The city `#homes` grid is the address-set
 * `getCityListings` tiles. When that fetch is complete (row count < the
 * requested cap), the visitor-visible hero / facts / JSON-LD count is the
 * tile count — not a smaller pulse that contradicts the doors on the page.
 *
 * When the fetch is empty, failed, or hit the cap, keep the pulse.
 */

export const CITY_TILE_FETCH_LIMIT = 1500

export type CityInventoryPublish = {
  count: number | null
  medianListPrice: number | null
  source: 'tiles' | 'pulse'
}

function asCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

function asMedian(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function publishCityInventory(args: {
  pulseCount: number | null | undefined
  pulseMedian: number | null | undefined
  tileCount: number
  tileMedian: number | null
  tileLimit: number
  tileFetchOk: boolean
}): CityInventoryPublish {
  const pulseCount = asCount(args.pulseCount)
  const pulseMedian = asMedian(args.pulseMedian)
  const tileCount = asCount(args.tileCount) ?? 0
  const tileMedian = asMedian(args.tileMedian)

  if (!args.tileFetchOk || tileCount <= 0) {
    return { count: pulseCount, medianListPrice: pulseMedian, source: 'pulse' }
  }
  if (tileCount >= args.tileLimit) {
    return { count: pulseCount, medianListPrice: pulseMedian, source: 'pulse' }
  }
  return { count: tileCount, medianListPrice: tileMedian ?? pulseMedian, source: 'tiles' }
}
