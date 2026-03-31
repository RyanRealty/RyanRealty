'use client'

import Link from 'next/link'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import type { EngagementCounts } from '@/app/actions/engagement'
import { Badge } from '@/components/ui/badge'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

type ListingWithClose = HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null }

type Props = {
  listings: ListingWithClose[]
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

function formatCloseDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RecentlySold({
  listings,
  savedKeys,
  likedKeys,
  signedIn,
  userEmail,
  engagementCounts,
}: Props) {
  if (listings.length === 0) return null

  return (
    <section className="w-full bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="recently-sold-heading">
      <div className="mx-auto w-full max-w-7xl">
        <TilesSlider
          title="Recently Sold"
          titleId="recently-sold-heading"
          headerRight={
            <Link
              href="/reports"
              className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
            >
              View market reports †’
            </Link>
          }
        >
          {listings.map((listing: ListingWithClose) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            const closePrice = listing.ClosePrice ?? (listing as { close_price?: number }).close_price
            const closeDate = listing.CloseDate ?? (listing as { close_date?: string }).close_date
            return (
              <TilesSliderItem key={key} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
                <div className="relative h-full">
                  <div className="absolute left-3 top-3 z-10">
                    <Badge variant="outline">Sold</Badge>
                  </div>
                  <HomeTileCard
                    listing={listing}
                    listingKey={String(key)}
                    monthlyPayment={undefined}
                    saved={signedIn && savedKeys.includes(String(key))}
                    liked={signedIn && likedKeys.includes(String(key))}
                    signedIn={signedIn}
                    userEmail={userEmail}
                    viewCount={engagementCounts?.[String(key)]?.view_count}
                    likeCount={engagementCounts?.[String(key)]?.like_count}
                    saveCount={engagementCounts?.[String(key)]?.save_count}
                    shareCount={engagementCounts?.[String(key)]?.share_count}
                  />
                  {(closePrice != null || closeDate) && (
                    <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-foreground/70 px-2 py-1.5 text-sm text-primary-foreground">
                      {closePrice != null && <span className="font-semibold">{formatPrice(closePrice)}</span>}
                      {closeDate && (
                        <span className="ml-1 opacity-90">Closed {formatCloseDate(closeDate)}</span>
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
