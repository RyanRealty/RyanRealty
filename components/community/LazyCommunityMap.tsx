'use client'

/**
 * Lazy wrapper around CommunityMap. Defers the @react-google-maps/api
 * bundle (~200KB gzipped including JS API loader) until the map is
 * actually in viewport. Without this lazy boundary the community LP's
 * initial bundle pulls the entire Google Maps SDK on every cold visit,
 * even when the visitor never scrolls below the hero (SITE_SPEC line 50).
 */
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type CommunityMap from '@/components/community/CommunityMap'

const CommunityMapClient = dynamic(
  () => import('@/components/community/CommunityMap'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-muted-foreground"
        style={{ minHeight: '400px' }}
      >
        Loading map…
      </div>
    ),
  }
)

export default function LazyCommunityMap(props: ComponentProps<typeof CommunityMap>) {
  return <CommunityMapClient {...props} />
}
