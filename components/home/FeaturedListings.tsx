'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { trackEvent } from '@/lib/tracking'

const SLIDER_TILE_WIDTH_PX = 320
const TILE_MIN_HEIGHT_PX = 340

type Props = {
  listings: HomeTileRow[]
  savedKeys: string[]
  likedKeys: string[]
  signedIn: boolean
  userEmail?: string | null
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
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
      className="bg-white px-4 py-12 sm:px-6 sm:py-16"
      aria-labelledby="featured-listings-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="featured-listings-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            Featured Homes
          </h2>
          <Link
            href="/search"
            onClick={() => trackEvent('click_cta', { cta_location: 'featured_view_all' })}
            className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            View All
          </Link>
        </div>
        <div className="relative mt-6">
          <div
            className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible"
            style={{ scrollbarWidth: 'thin' }}
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
                <div
                  key={key}
                  className="min-w-[280px] shrink-0 md:min-w-0"
                  style={{ minHeight: TILE_MIN_HEIGHT_PX }}
                >
                  <HomeTileCard
                    listing={listing}
                    listingKey={String(key)}
                    monthlyPayment={formatMonthlyPayment(monthly)}
                    saved={signedIn && savedKeys.includes(String(key))}
                    liked={signedIn && likedKeys.includes(String(key))}
                    signedIn={signedIn}
                    userEmail={userEmail}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
