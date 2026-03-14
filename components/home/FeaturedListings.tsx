'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import type { EngagementCounts } from '@/app/actions/engagement'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { trackEvent } from '@/lib/tracking'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

type Props = {
  listings: HomeTileRow[]
  savedKeys: string[]
  likedKeys: string[]
  signedIn: boolean
  userEmail?: string | null
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
  engagementCounts?: Record<string, EngagementCounts>
}

export default function FeaturedListings({
  listings,
  savedKeys,
  likedKeys,
  signedIn,
  userEmail,
  downPaymentPercent,
  interestRate,
  loanTermYears,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current || !sectionRef.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          sentRef.current = true
          trackEvent('featured_impression', {})
          trackEvent('view_featured_listings', { count: listings.length })
        }
      },
      { threshold: 0.2 }
    )
    io.observe(sectionRef.current)
    return () => io.disconnect()
  }, [listings.length])

  if (listings.length === 0) return null

  return (
    <section
      ref={sectionRef}
      className="w-full bg-card px-4 py-12 sm:px-6 sm:py-16"
      aria-labelledby="featured-listings-heading"
    >
      <div className="mx-auto w-full max-w-7xl">
        <TilesSlider
          title="Featured Homes"
          titleId="featured-listings-heading"
          headerRight={
            <Link
              href="/homes-for-sale"
              onClick={() => trackEvent('click_cta', { cta_location: 'featured_view_all' })}
              className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
            >
              View all featured homes →
            </Link>
          }
        >
          {listings.map((listing) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            const monthly = estimatedMonthlyPayment(
              listing.ListPrice ?? 0,
              downPaymentPercent,
              interestRate,
              loanTermYears
            )
            return (
              <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
                <HomeTileCard
                  listing={listing}
                  listingKey={String(key)}
                  monthlyPayment={formatMonthlyPayment(monthly)}
                  saved={signedIn && savedKeys.includes(String(key))}
                  liked={signedIn && likedKeys.includes(String(key))}
                  signedIn={signedIn}
                  userEmail={userEmail}
                />
              </TilesSliderItem>
            )
          })}
        </TilesSlider>
      </div>
    </section>
  )
}
