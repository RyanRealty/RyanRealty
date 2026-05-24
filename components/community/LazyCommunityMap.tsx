'use client'

/**
 * Lazy wrapper around CommunityMap. Defers the @react-google-maps/api
 * bundle (~200KB gzipped including JS API loader) until the map is
 * actually in viewport. Without this lazy boundary the community LP's
 * initial bundle pulls the entire Google Maps SDK on every cold visit,
 * even when the visitor never scrolls below the hero (SITE_SPEC line 50).
 *
 * Skeleton must match the FINAL <section> shape that CommunityMap renders
 * once loaded (chrome + heading + 400px map). Mismatched skeleton was the
 * source of the 0.388 CLS regression on /communities/[slug] flagged by
 * lhci 2026-05-24.
 */
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type CommunityMap from '@/components/community/CommunityMap'

function MapSkeleton() {
  return (
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-7xl">
        {/* Heading placeholder — same vertical footprint as the loaded "<communityName> Map" h2 */}
        <div className="h-8 w-1/2 rounded bg-muted-foreground/10" />
        <div className="mt-4 h-[400px] w-full rounded-lg bg-muted-foreground/10 animate-pulse" />
      </div>
    </section>
  )
}

const CommunityMapClient = dynamic(
  () => import('@/components/community/CommunityMap'),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  }
)

export default function LazyCommunityMap(props: ComponentProps<typeof CommunityMap>) {
  return <CommunityMapClient {...props} />
}
