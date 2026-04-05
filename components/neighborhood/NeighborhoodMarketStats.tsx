'use client'

import GeoMarketOverview from '@/components/geo-page/GeoMarketOverview'
import { reportsExploreYtdPath } from '@/lib/slug'
import type { YearSeriesPoint } from '@/lib/report-year-compare'

type Props = {
  neighborhoodName: string
  cityName: string
  citySlug: string
  stats: {
    medianPrice: number | null
    count: number
    avgDom: number | null
    closedLast12Months: number
  }
  priceHistory: { month: string; medianPrice: number; soldCount?: number }[]
  salesHistory?: YearSeriesPoint[]
}

/**
 * Market Overview for neighborhood page. Uses shared GeoMarketOverview.
 * Full report links to city report (no neighborhood-specific report route).
 */
export default function NeighborhoodMarketStats({
  neighborhoodName,
  cityName,
  stats,
  priceHistory,
  salesHistory,
}: Props) {
  return (
    <GeoMarketOverview
      placeName={neighborhoodName}
      headingId="neighborhood-market-heading"
      stats={stats}
      priceHistory={priceHistory}
      salesHistory={salesHistory}
      fullReportHref={`/reports/city/${encodeURIComponent(cityName)}`}
      ytdReportHref={reportsExploreYtdPath(cityName)}
      trackContext="neighborhood_market_stats"
    />
  )
}
