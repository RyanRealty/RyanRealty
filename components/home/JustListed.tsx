'use client'

import Link from 'next/link'
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
  if (listings.length === 0) return null

  return (
    <section className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="just-listed-heading">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="just-listed-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            Just Listed
          </h2>
          <Link
            href="/search?sort=newest"
            className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            View All
          </Link>
        </div>
        <div
          className="mt-6 flex gap-4 overflow-x-auto pb-2"
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
                className="relative min-w-[280px] shrink-0 md:min-w-[300px]"
                style={{ minHeight: TILE_MIN_HEIGHT_PX }}
              >
                <div className="absolute left-3 top-3 z-10">
                  <Badge variant="new">New</Badge>
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
    </section>
  )
}
