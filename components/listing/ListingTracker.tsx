'use client'

import { useEffect, useRef } from 'react'
import { trackEvent, trackListingView } from '@/lib/tracking'
import { fireFirstPartyEvent } from '@/components/VisitTracker'

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
          // First-party only. GA4's scroll_depth comes from V3SectionTracker,
          // which runs on every public page including this one; a second push
          // here sent two scroll_depth per quartile (live test 2026-10-14).
          // W1.3: per-person scroll depth on listing-detail pages in the CRM.
          fireFirstPartyEvent('scroll_depth', {
            listingMls: listingId,
            scrollDepthPct: m,
            metadata: { surface: 'listing_detail', listingKey },
          })
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
          // Time on page is dwell, not scroll_depth: sent as scroll_depth it
          // reached GA4 with no depth and no time (2026-10-14 audit).
          trackEvent('dwell', { listing_key: listingKey, seconds: s })
        }
      })
    }, 5000)
    return () => clearInterval(t)
  }, [listingKey])

  return null
}
