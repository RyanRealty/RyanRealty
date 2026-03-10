'use client'

import { useRef, useEffect } from 'react'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import Badge from '@/components/ui/Badge'

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

export default function TrendingListings({
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
        if (entries[0]?.isIntersecting) sentRef.current = true
      },
      { threshold: 0.2 }
    )
    io.observe(sectionRef.current)
    return () => io.disconnect()
  }, [])

  if (listings.length === 0) return null

  return (
    <section
      ref={sectionRef}
      className="bg-white px-4 py-12 sm:px-6 sm:py-16"
      aria-labelledby="trending-listings-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>🔥</span>
          <h2 id="trending-listings-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            Trending Now
          </h2>
        </div>
        <p className="mt-1 text-[var(--text-secondary)]">Most viewed homes this week</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
          <div
            className="flex gap-4 overflow-x-auto pb-2 md:contents"
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
                  className="relative min-w-[280px] shrink-0 md:min-w-0"
                  style={{ minHeight: TILE_MIN_HEIGHT_PX }}
                >
                  <div className="absolute left-3 top-3 z-10">
                    <Badge variant="hot">Hot</Badge>
                  </div>
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
