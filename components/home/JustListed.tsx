'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import type { EngagementCounts } from '@/app/actions/engagement'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
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

export default function JustListed({
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

  if (listings.length === 0) return null

  return (
    <section
      ref={sectionRef}
      className="w-full bg-muted px-4 py-12 sm:px-6 sm:py-16"
      aria-labelledby="just-listed-heading"
    >
      <div className="w-full">
        <TilesSlider
          title="Just Listed"
          titleId="just-listed-heading"
          headerRight={
            <Link
              href="/homes-for-sale?sort=newest"
              className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
            >
              View All
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
