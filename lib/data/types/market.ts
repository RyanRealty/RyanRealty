/**
 * Market-data domain types. The canonical sources are:
 *   - `market_stats_cache` (6h freshness, period-anchored aggregates)
 *   - `market_pulse_live` (10-15min freshness, current inventory)
 */

import type { Currency, GeoType, IsoTimestamp, Slug } from './shared'

export type MoSVerdict = 'sellers' | 'balanced' | 'buyers'

export type MarketStats = {
  geoType: GeoType
  geoSlug: Slug
  periodType: 'rolling_30d' | 'rolling_90d' | 'rolling_365d' | 'monthly' | 'ytd'
  periodStart: IsoTimestamp
  periodEnd: IsoTimestamp
  medianSalePrice: Currency | null
  medianListPrice: Currency | null
  medianDaysOnMarket: number | null
  monthsOfSupply: number | null
  mosVerdict: MoSVerdict | null
  saleToListRatio: number | null
  soldCount: number | null
  activeCount: number | null
  yoyChangePct: number | null
  refreshedAt: IsoTimestamp
  methodologyVersion: string
}

export type MarketPulse = {
  geoType: GeoType
  geoSlug: Slug
  activeCount: number
  medianListPrice: Currency | null
  newThisWeek: number
  /** Approximation of price-drop activity as a percent (0-100). */
  priceDropsThisWeek: number
  closedLast30Days: number
  /** Sourced from market_pulse_live.months_of_supply. */
  monthsOfSupply: number | null
  /** Sourced from market_pulse_live.median_days_to_pending. */
  medianDaysToPending: number | null
  refreshedAt: IsoTimestamp
}

export type PriceHistoryPoint = {
  periodStart: IsoTimestamp
  medianSalePrice: Currency | null
  soldCount: number | null
}

export type MarketReport = {
  slug: Slug
  geoType: GeoType
  geoSlug: Slug
  title: string
  publishedAt: IsoTimestamp
  summary: string
  bodyMarkdown: string
  citationsJson: unknown
  pdfUrl: string | null
}

/**
 * Full market_stats_cache projection for the per-city market report detail
 * section. Sourced from confirmed-existing columns only (getCityMarketDetail.ts).
 *
 * §0 trace — every field maps 1:1 to a verified column in market_stats_cache:
 *   medianSalePrice        ← median_sale_price
 *   avgSalePrice           ← avg_sale_price
 *   totalVolume            ← total_volume
 *   soldCount              ← sold_count
 *   medianDom              ← median_dom
 *   medianPricePerSqft     ← median_price_per_sqft_closed
 *   avgSaleToListRatio     ← avg_sale_to_list_ratio
 *   yoyMedianPriceDeltaPct ← yoy_median_price_delta_pct
 *   yoyPpsfChangePct       ← yoy_ppsf_change_pct
 *   yoyDomChange           ← yoy_dom_change
 *   marketHealthLabel      ← market_health_label
 *   marketHealthScore      ← market_health_score
 *   endOfPeriodInventory   ← end_of_period_inventory
 *   cashPurchasePct        ← cash_purchase_pct
 *   medianConcessionsAmount← median_concessions_amount
 *   periodStart            ← period_start
 *   periodEnd              ← period_end
 *   periodType             ← period_type
 *   geoLabel               ← geo_label
 *   updatedAt              ← updated_at
 *   methodologyVersion     ← methodology_version
 */
export type MarketDetail = {
  geoType: GeoType
  geoSlug: Slug
  geoLabel: string | null
  periodType: 'rolling_30d' | 'rolling_90d' | 'rolling_365d' | 'monthly' | 'ytd'
  periodStart: IsoTimestamp | null
  periodEnd: IsoTimestamp | null
  medianSalePrice: Currency | null
  avgSalePrice: Currency | null
  totalVolume: Currency | null
  soldCount: number | null
  medianDom: number | null
  medianPricePerSqft: number | null
  avgSaleToListRatio: number | null
  yoyMedianPriceDeltaPct: number | null
  yoyPpsfChangePct: number | null
  yoyDomChange: number | null
  marketHealthLabel: string | null
  marketHealthScore: number | null
  endOfPeriodInventory: number | null
  cashPurchasePct: number | null
  medianConcessionsAmount: Currency | null
  updatedAt: IsoTimestamp | null
  methodologyVersion: string | null
}
