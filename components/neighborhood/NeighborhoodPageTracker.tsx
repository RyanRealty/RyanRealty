'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'

type Props = {
  neighborhoodName: string
  cityName: string
  citySlug: string
  neighborhoodSlug: string
  listingCount: number
  medianPrice: number | null
}

export default function NeighborhoodPageTracker({
  neighborhoodName,
  cityName,
  citySlug,
  neighborhoodSlug,
  listingCount,
  medianPrice,
}: Props) {
  const sentRef = useRef(false)
  const scrollMilestones = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true
    trackEvent('neighborhood_view', {
      neighborhood_name: neighborhoodName,
      city_name: cityName,
      listing_count: listingCount,
      median_price: medianPrice ?? undefined,
    })
  }, [neighborhoodName, cityName, listingCount, medianPrice])

  useEffect(() => {
    const milestones = [25, 50, 75, 100]
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) return
      const pct = Math.round((window.scrollY / scrollHeight) * 100)
      milestones.forEach((m) => {
        if (pct >= m && !scrollMilestones.current.has(m)) {
          scrollMilestones.current.add(m)
          trackEvent('scroll_depth', {
            page_type: 'neighborhood',
            city_slug: citySlug,
            neighborhood_slug: neighborhoodSlug,
            depth_percent: m,
          })
        }
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [citySlug, neighborhoodSlug])

  return null
}
