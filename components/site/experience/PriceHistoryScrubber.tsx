/**
 * PriceHistoryScrubber -- Experience System shared module
 *
 * Scrubbable recharts AreaChart for the price-history section of Geo archetype
 * pages. Users drag or touch-scrub the chart to see month + median in a large
 * tabular readout. Falls back to a static chart if < 6 data points.
 *
 * Architecture: thin server-safe wrapper (this file) + dynamic-imported client
 * island (PriceHistoryScrubber.client.tsx) via next/dynamic with ssr: false.
 * The recharts bundle only ships to routes that render this module.
 *
 * Data: receives pre-fetched PriceHistoryPoint[] from the parent page (via
 * getPriceHistory DAL). This component does NO data fetching of its own. Per
 * CLAUDE.md §0: data must be from market_stats_cache via getPriceHistory().
 *
 * Engagement: fires `chart_scrub` module_interact event on first scrub.
 */
'use client'

import dynamic from 'next/dynamic'
import type { PriceHistoryPoint } from '@/lib/data/types/market'

const ScrubberClient = dynamic(() => import('./PriceHistoryScrubber.client'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="h-[260px] rounded-[14px] border border-border bg-card animate-pulse"
    />
  ),
})

type Props = {
  data: ReadonlyArray<PriceHistoryPoint>
  sectionId?: string
  /** Chart height in px. Default 240. */
  height?: number
}

export function PriceHistoryScrubber({ data, sectionId = 'price-scrubber', height = 240 }: Props) {
  if (data.length < 2) return null
  return <ScrubberClient data={data} sectionId={sectionId} height={height} />
}
