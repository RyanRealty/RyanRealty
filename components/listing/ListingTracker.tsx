'use client'

import { useEffect, useRef } from 'react'
import { trackEvent, trackListingView } from '@/lib/tracking'

type Props = {
  listingKey: string
  listingId: string
  price?: number
  community?: string
  city?: string
  beds?: number
  baths?: number
}

export default function ListingTracker({ listingKey, listingId, price, community, city, beds, baths }: Props) {
  const scrollMilestones = useRef<Set<number>>(new Set())
  const timeMilestones = useRef<Set<number>>(new Set())
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true

    const listingUrl = typeof window !== 'undefined' ? window.location.href : ''
    trackListingView({
      listingKey,
      listingUrl,
      price,
      city: city ?? undefined,
      mlsNumber: listingId,
      bedrooms: beds ?? undefined,
      bathrooms: baths ?? undefined,
    })
    trackEvent('view_listing', {
      listing_id: listingKey,
      listing_price: price,
      community: community ?? undefined,
      city: city ?? undefined,
      beds: beds ?? undefined,
      baths: baths ?? undefined,
    })

    fetch(`/api/listings/${encodeURIComponent(listingKey)}/track`, { method: 'POST', keepalive: true }).catch(() => {})
  }, [listingKey, listingId, price, community, city, beds, baths])

  useEffect(() => {
    const milestones = [25, 50, 75, 100]
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) return
      const pct = Math.round((window.scrollY / scrollHeight) * 100)
      milestones.forEach((m) => {
        if (pct >= m && !scrollMilestones.current.has(m)) {
          scrollMilestones.current.add(m)
          trackEvent('scroll_depth', { listing_key: listingKey, depth_percent: m })
        }
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [listingKey])

  useEffect(() => {
    const times = [30, 60, 120, 300]
    const start = Date.now()
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      times.forEach((s) => {
        if (elapsed >= s && !timeMilestones.current.has(s)) {
          timeMilestones.current.add(s)
          trackEvent('scroll_depth', { listing_key: listingKey, time_on_page_seconds: s })
        }
      })
    }, 5000)
    return () => clearInterval(t)
  }, [listingKey])

  return null
}
