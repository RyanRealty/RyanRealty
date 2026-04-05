'use client'

import GeoMarketOverview from '@/components/geo-page/GeoMarketOverview'
import { reportsExploreYtdPath } from '@/lib/slug'
import type { YearSeriesPoint } from '@/lib/report-year-compare'

type Props = {
  communityName: string
  city: string
  subdivision: string
  slug: string
  stats: { medianPrice: number | null; count: number; avgDom: number | null; closedLast12Months: number }
  priceHistory: { month: string; medianPrice: number; soldCount?: number }[]
  salesHistory?: YearSeriesPoint[]
}

export default function CommunityMarketStats({ communityName, city, subdivision, stats, priceHistory, salesHistory }: Props) {
  return (
    <GeoMarketOverview
      placeName={communityName}
      headingId="market-stats-heading"
      stats={stats}
      priceHistory={priceHistory}
      salesHistory={salesHistory}
      fullReportHref={`/reports/community/${encodeURIComponent(communityName)}`}
      ytdReportHref={reportsExploreYtdPath(city, subdivision)}
      trackContext="community_market_stats"
    />
  )
}
