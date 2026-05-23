'use client'

/**
 * Lazy wrapper around GeoMarketOverview. Defers the recharts bundle
 * (~100KB gzipped) until the city / neighborhood / community LP is
 * scrolled to the market overview section. Without this lazy boundary
 * every cold visit to /cities/[slug], /cities/[slug]/[neighborhoodSlug],
 * and /communities/[slug] ships recharts in the initial bundle even
 * when the visitor never scrolls past the hero (SITE_SPEC line 50).
 */
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type GeoMarketOverview from '@/components/geo-page/GeoMarketOverview'

const GeoMarketOverviewClient = dynamic(
  () => import('@/components/geo-page/GeoMarketOverview'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground"
        style={{ minHeight: '420px' }}
      >
        Loading market overview…
      </div>
    ),
  }
)

export default function LazyGeoMarketOverview(
  props: ComponentProps<typeof GeoMarketOverview>,
) {
  return <GeoMarketOverviewClient {...props} />
}
