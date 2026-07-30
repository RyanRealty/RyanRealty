'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'

type Props = {
  slug: string
  communityName: string
  city: string
  /** null when the reads degraded — an unknown count is not a zero (§0). */
  activeCount: number | null
  medianPrice: number | null
}

export default function CommunityPageTracker({
  slug,
  communityName,
  city,
  activeCount,
  medianPrice,
}: Props) {
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true
    // ONE event name per fact (conversion-audit 2026-07-15 #18): this fired
    // both 'community_view' and 'view_community' from the same effect,
    // double-counting every community pageview in GA4. 'view_community'
    // (GA4 verb-first convention) keeps the union of both param sets.
    trackEvent('view_community', {
      community_name: communityName,
      community_slug: slug,
      city,
      listing_count: activeCount,
      median_price: medianPrice ?? undefined,
    })
  }, [slug, communityName, city, activeCount, medianPrice])

  // Scroll depth is owned by KbSectionTracker (the KB page tracker) so it fires
  // exactly once per milestone. This tracker only emits the community-view identity.
  return null
}
