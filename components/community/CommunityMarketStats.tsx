'use client'

import GeoMarketOverview from '@/components/geo-page/GeoMarketOverview'

type Props = {
  communityName: string
  slug: string
  stats: { medianPrice: number | null; count: number; avgDom: number | null; closedLast12Months: number }
  priceHistory: { month: string; medianPrice: number }[]
}

export default function CommunityMarketStats({ communityName, slug, stats, priceHistory }: Props) {
  return (
    <GeoMarketOverview
      placeName={communityName}
      headingId="market-stats-heading"
      stats={stats}
      priceHistory={priceHistory}
      fullReportHref={`/reports/community/${encodeURIComponent(communityName)}`}
      trackContext="community_market_stats"
    />
  )
}
