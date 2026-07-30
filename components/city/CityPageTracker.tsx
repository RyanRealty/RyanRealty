'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'

type Props = {
  cityName: string
  slug: string
  /** null when the pulse read degraded — an unknown count is not a zero (§0). */
  listingCount: number | null
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
    // ONE event name per fact (conversion-audit 2026-07-15 #18): this fired
    // both 'city_view' and 'view_city' from the same effect, double-counting
    // every city pageview in GA4. 'view_city' (GA4 verb-first convention)
    // keeps the union of both param sets.
    trackEvent('view_city', {
      city_name: cityName,
      city_slug: slug,
      listing_count: listingCount,
      median_price: medianPrice ?? undefined,
      community_count: communityCount,
    })
  }, [cityName, slug, listingCount, medianPrice, communityCount])

  // Scroll depth is owned by KbSectionTracker (the KB page tracker) so it fires
  // exactly once per milestone. This tracker only emits the city-view identity.
  return null
}
