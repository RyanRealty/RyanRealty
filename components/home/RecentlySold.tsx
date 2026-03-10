'use client'

import Link from 'next/link'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import Badge from '@/components/ui/Badge'

const TILE_MIN_HEIGHT_PX = 340

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
}: Props) {
  if (listings.length === 0) return null

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="recently-sold-heading">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="recently-sold-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            Recently Sold
          </h2>
          <Link
            href="/reports"
            className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            See Market Reports
          </Link>
        </div>
        <div
          className="mt-6 flex gap-4 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          {listings.map((listing: ListingWithClose) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            const closePrice = listing.ClosePrice ?? (listing as { close_price?: number }).close_price
            const closeDate = listing.CloseDate ?? (listing as { close_date?: string }).close_date
            return (
              <div
                key={key}
                className="relative min-w-[280px] shrink-0 md:min-w-[300px]"
                style={{ minHeight: TILE_MIN_HEIGHT_PX }}
              >
                <div className="absolute left-3 top-3 z-10">
                  <Badge variant="sold">Sold</Badge>
                </div>
                <div className="relative">
                  <HomeTileCard
                    listing={listing}
                    listingKey={String(key)}
                    monthlyPayment={undefined}
                    saved={signedIn && savedKeys.includes(String(key))}
                    liked={signedIn && likedKeys.includes(String(key))}
                    signedIn={signedIn}
                    userEmail={userEmail}
                  />
                  {(closePrice != null || closeDate) && (
                    <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/70 px-2 py-1.5 text-sm text-white">
                      {closePrice != null && <span className="font-semibold">{formatPrice(closePrice)}</span>}
                      {closeDate && (
                        <span className="ml-1 opacity-90">Closed {formatCloseDate(closeDate)}</span>
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
