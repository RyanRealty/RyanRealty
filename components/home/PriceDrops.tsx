'use client'

import Link from 'next/link'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import Badge from '@/components/ui/Badge'

const TILE_MIN_HEIGHT_PX = 340

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
}: Props) {
  if (listings.length === 0) return null

  return (
    <section className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="price-drops-heading">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="price-drops-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            Price Reductions
          </h2>
          <Link
            href="/search?priceDrops=true"
            className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            View All
          </Link>
        </div>
        <div
          className="mt-6 flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin' }}
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
                ? Math.round((listing.savings ?? 0) / listing.originalPrice * 100)
                : null
            return (
              <div
                key={key}
                className="relative min-w-[280px] shrink-0 md:min-w-[300px]"
                style={{ minHeight: TILE_MIN_HEIGHT_PX }}
              >
                <div className="absolute left-3 top-3 z-10">
                  <Badge variant="price-drop">Price Drop</Badge>
                </div>
                <div className="relative">
                  <HomeTileCard
                    listing={listing}
                    listingKey={String(key)}
                    monthlyPayment={formatMonthlyPayment(monthly)}
                    saved={signedIn && savedKeys.includes(String(key))}
                    liked={signedIn && likedKeys.includes(String(key))}
                    signedIn={signedIn}
                    userEmail={userEmail}
                  />
                  {listing.originalPrice != null && listing.ListPrice != null && listing.originalPrice > listing.ListPrice && (
                    <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/70 px-2 py-1.5 text-sm text-white">
                      <span className="line-through">{formatPrice(listing.originalPrice)}</span>
                      {' → '}
                      <span className="font-semibold">{formatPrice(listing.ListPrice)}</span>
                      {pct != null && pct > 0 && (
                        <span className="ml-1 text-emerald-300">−{pct}%</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
