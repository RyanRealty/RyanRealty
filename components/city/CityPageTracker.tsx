'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'

type Props = {
  cityName: string
  slug: string
  listingCount: number
  medianPrice: number | null
  communityCount: number
}

export default function CityPageTracker({
  cityName,
  slug,
  listingCount,
  medianPrice,
  communityCount,
}: Props) {
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true
    trackEvent('city_view', {
      city_name: cityName,
      city_slug: slug,
      listing_count: listingCount,
      median_price: medianPrice ?? undefined,
      community_count: communityCount,
    })
    trackEvent('view_city', {
      city_name: cityName,
      listing_count: listingCount,
    })
  }, [cityName, slug, listingCount, medianPrice, communityCount])

  // Scroll depth is owned by KbSectionTracker (the KB page tracker) so it fires
  // exactly once per milestone. This tracker only emits the city-view identity.
  return null
}
