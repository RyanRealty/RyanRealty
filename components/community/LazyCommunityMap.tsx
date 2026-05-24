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

// Just the 400px map placeholder — section chrome + heading lives in the
// page (app/communities/[slug]/page.tsx) so the SSR'd HTML matches the
// post-mount DOM byte-for-byte. Previously this skeleton + CommunityMap's
// internal section duplicated the page chrome and produced CLS=0.388.
function MapSkeleton() {
  return (
    <div className="h-[400px] w-full rounded-lg bg-muted-foreground/10 animate-pulse" />
  )
}

// ssr:false is required because @react-google-maps/api references `window`
// at module top-level (server-side import crashes the build).
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
