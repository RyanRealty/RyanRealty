'use client'

import Link from 'next/link'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import type { EngagementCounts } from '@/app/actions/engagement'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { Badge } from '@/components/ui/badge'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

type ListingWithDrop = HomeTileRow & { originalPrice?: number; savings?: number }

type Props = {
  listings: ListingWithDrop[]
  savedKeys: string[]
  likedKeys: string[]
  signedIn: boolean
  userEmail?: string | null
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
  engagementCounts?: Record<string, EngagementCounts>
}

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function PriceDrops({
  listings,
  savedKeys,
  likedKeys,
  signedIn,
  userEmail,
  downPaymentPercent,
  interestRate,
  loanTermYears,
  engagementCounts,
}: Props) {
  if (listings.length === 0) return null

  return (
    <section className="w-full bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="price-drops-heading">
      <div className="w-full">
        <TilesSlider
          title="Price Reductions"
          titleId="price-drops-heading"
          headerRight={
            <Link
              href="/homes-for-sale?priceDrops=true"
              className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
            >
              View All
            </Link>
          }
        >
          {listings.map((listing: ListingWithDrop) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            const monthly = estimatedMonthlyPayment(
              listing.ListPrice ?? 0,
              downPaymentPercent,
              interestRate,
              loanTermYears
            )
            const pct =
              listing.originalPrice != null &&
              listing.ListPrice != null &&
              listing.originalPrice > 0
                ? Math.round(((listing.savings ?? 0) / listing.originalPrice) * 100)
                : null
            return (
              <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
                <div className="relative h-full">
                  <div className="absolute left-3 top-3 z-10">
                    <Badge variant="destructive">Price Drop</Badge>
                  </div>
                  <HomeTileCard
                    listing={listing}
                    listingKey={String(key)}
                    monthlyPayment={formatMonthlyPayment(monthly)}
                    saved={signedIn && savedKeys.includes(String(key))}
                    liked={signedIn && likedKeys.includes(String(key))}
                    signedIn={signedIn}
                    userEmail={userEmail}
                    likeCount={engagementCounts?.[String(key)]?.like_count}
                    saveCount={engagementCounts?.[String(key)]?.save_count}
                    shareCount={engagementCounts?.[String(key)]?.share_count}
                  />
                  {listing.originalPrice != null &&
                    listing.ListPrice != null &&
                    listing.originalPrice > listing.ListPrice && (
                      <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/70 px-2 py-1.5 text-sm text-white">
                        <span className="line-through">{formatPrice(listing.originalPrice)}</span>
                        {' → '}
                        <span className="font-semibold">{formatPrice(listing.ListPrice)}</span>
                        {pct != null && pct > 0 && (
                          <span className="ml-1 text-success">−{pct}%</span>
                        )}
                      </div>
                    )}
                </div>
              </TilesSliderItem>
            )
          })}
        </TilesSlider>
      </div>
    </section>
  )
}
