'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'

type Props = {
  brokerName: string
  brokerSlug: string
  listingCount: number
  reviewCount: number
}

export default function BrokerPageTracker({
  brokerName,
  brokerSlug,
  listingCount,
  reviewCount,
}: Props) {
  const sentRef = useRef(false)
  const scrollMilestones = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (sentRef.current) return
    sentRef.current = true
    trackEvent('broker_view', {
      broker_name: brokerName,
      broker_slug: brokerSlug,
      listing_count: listingCount,
      review_count: reviewCount,
    })
  }, [brokerName, brokerSlug, listingCount, reviewCount])

  useEffect(() => {
    const milestones = [25, 50, 75, 100]
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      if (scrollHeight <= 0) return
      const pct = Math.round((window.scrollY / scrollHeight) * 100)
      milestones.forEach((m) => {
        if (pct >= m && !scrollMilestones.current.has(m)) {
          scrollMilestones.current.add(m)
          trackEvent('scroll_depth', { page_type: 'broker', broker_slug: brokerSlug, depth_percent: m })
        }
      })
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [brokerSlug])

  return null
}
