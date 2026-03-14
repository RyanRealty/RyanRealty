'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'

type Props = {
  communityName: string
  listingCount: number
  medianPrice: number | null
}

export default function CommunityPageTracker({
  communityName,
  listingCount,
  medianPrice,
}: Props) {
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true
    trackEvent('community_view', {
      community_name: communityName,
      listing_count: listingCount,
      median_price: medianPrice ?? undefined,
    })
    trackEvent('view_community', {
      community_name: communityName,
      listing_count: listingCount,
    })
  }, [communityName, listingCount, medianPrice])

  return null
}
