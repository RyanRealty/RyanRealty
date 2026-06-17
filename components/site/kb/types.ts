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
  /** Community Area Guide clip (silent, graded, hosted from Drive via
   *  scripts/sync-city-videos.mjs). Plays as a muted background loop when the
   *  card is the in-focus card on screen or on hover, same as a listing tile. */
  video?: { url: string; embedType: 'iframe' | 'video-tag' } | null
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
  /** Listing video tour, when the MLS feed has one — played as a muted
   *  background loop on hover (iframe embed or direct mp4). `link`-type
   *  videos (host blocks framing) are omitted so the card stays photo-only. */
  video?: { url: string; embedType: 'iframe' | 'video-tag' } | null
  /** The home has a video/3D tour that CANNOT autoplay chrome-less in the tile
   *  (Aryeo watch page, Zillow 3D, Matterport, iGuide). The tile stays photo but
   *  shows a "Tour" badge that opens the listing where the tour plays. */
  tour?: boolean
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
