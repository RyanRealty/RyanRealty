'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'

type Props = {
  slug: string
  communityName: string
  city: string
  activeCount: number
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
    trackEvent('community_view', {
      community_name: communityName,
      community_slug: slug,
      city,
      listing_count: activeCount,
      median_price: medianPrice ?? undefined,
    })
    trackEvent('view_community', {
      community_name: communityName,
      listing_count: activeCount,
    })
  }, [slug, communityName, city, activeCount, medianPrice])

  // Scroll depth is owned by KbSectionTracker (the KB page tracker) so it fires
  // exactly once per milestone. This tracker only emits the community-view identity.
  return null
}
