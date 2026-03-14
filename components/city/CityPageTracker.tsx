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
  const scrollMilestones = useRef<Set<number>>(new Set())

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

  useEffect(() => {
    const milestones = [25, 50, 75, 100]
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) return
      const pct = Math.round((window.scrollY / scrollHeight) * 100)
      milestones.forEach((m) => {
        if (pct >= m && !scrollMilestones.current.has(m)) {
          scrollMilestones.current.add(m)
          trackEvent('scroll_depth', { page_type: 'city', city_slug: slug, depth_percent: m })
        }
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [slug])

  return null
}
