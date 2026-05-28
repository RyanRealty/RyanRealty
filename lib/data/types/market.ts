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
