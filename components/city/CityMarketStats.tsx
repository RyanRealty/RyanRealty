'use client'

import GeoMarketOverview from '@/components/geo-page/GeoMarketOverview'
import { reportsExploreYtdPath } from '@/lib/slug'
import type { YearSeriesPoint } from '@/lib/report-year-compare'

type Props = {
  cityName: string
  slug: string
  stats: { medianPrice: number | null; count: number; avgDom: number | null; closedLast12Months: number }
  priceHistory: { month: string; medianPrice: number; soldCount?: number }[]
  salesHistory?: YearSeriesPoint[]
}

export default function CityMarketStats({ cityName, stats, priceHistory, salesHistory }: Props) {
  return (
    <GeoMarketOverview
      placeName={cityName}
      headingId="city-market-heading"
      stats={stats}
      priceHistory={priceHistory}
      salesHistory={salesHistory}
      fullReportHref={`/reports/city/${encodeURIComponent(cityName)}`}
      ytdReportHref={reportsExploreYtdPath(cityName)}
      trackContext="city_market_stats"
    />
  )
}
