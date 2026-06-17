// Data contracts for the kinetic-brutalist (KB) homepage section islands.
// The server page fetches live DAL data and passes these props down; islands
// render markup + motion only (no client data fetch). Expanded as sections land.

export interface KbHeroData {
  activeCount: number | null
  medianListPrice: number | null
  medianDaysToPending: number | null
}

export interface KbTownItem {
  name: string
  activeCount: number
  medianPrice: number | null
  href: string
  img: string
}

export interface KbCommunityItem {
  name: string
  activeCount: number
  town: string
  href: string
  img: string
}

export interface KbSellData {
  medianListPrice: number | null
  medianDaysToPending: number | null
  soldCount30d: number | null
}

export interface KbReview {
  quote: string
  author: string
}

export interface KbTickerItem {
  price: number | null
  address: string
  town: string
}

export interface KbFeaturedItem {
  price: number | null
  address: string
  sub: string
  city: string
  beds: number | null
  baths: number | null
  sqft: number | null
  img: string
  href: string
}

// Market HUD — every figure traces to a cached DAL source (§0):
// counts/medianList/daysToPending/monthsSupply -> getRegionPulse;
// saleToList -> getMarketStatsCacheRowForGeo(region).avg_sale_to_list_ratio;
// trend -> getPriceHistory(region, monthly, 13); byTown -> getCitiesForIndex.
export interface KbMarketData {
  active: number | null
  closed30: number | null
  new30: number | null
  medianList: number | null
  saleToList: number | null
  daysToPending: number | null
  monthsSupply: number | null
  trend: { label: string; value: number }[]
  byTown: { name: string; median: number }[]
  countyMedian: number | null
}

/** Formats a price to the nearest thousand: 740123 -> "$740,000". */
export function kbMoney(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  return `$${Math.round(n / 1000)}K`
}

/** Full currency to the nearest thousand: 740123 -> "$740,000". */
export function kbMoneyFull(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}
