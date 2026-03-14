'use client'

import GeoMarketOverview from '@/components/geo-page/GeoMarketOverview'

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
  priceHistory: { month: string; medianPrice: number }[]
}

/**
 * Market Overview for neighborhood page. Uses shared GeoMarketOverview.
 * Full report links to city report (no neighborhood-specific report route).
 */
export default function NeighborhoodMarketStats({
  neighborhoodName,
  cityName,
  citySlug,
  stats,
  priceHistory,
}: Props) {
  return (
    <GeoMarketOverview
      placeName={neighborhoodName}
      headingId="neighborhood-market-heading"
      stats={stats}
      priceHistory={priceHistory}
      fullReportHref={`/reports/city/${encodeURIComponent(cityName)}`}
      trackContext="neighborhood_market_stats"
    />
  )
}
