'use client'

import Link from 'next/link'
import type { CityListingRow } from '@/app/actions/cities'
import HomeTileCard from '@/components/home/HomeTileCard'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'

type SoldListing = CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null }

type DisplayPrefs = {
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

type Props = {
  neighborhoodName: string
  citySlug: string
  listings: CityListingRow[]
  soldListings: SoldListing[]
  savedKeys: string[]
  likedKeys: string[]
  signedIn: boolean
  userEmail?: string | null
  displayPrefs: DisplayPrefs
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NeighborhoodListings({
  neighborhoodName,
  citySlug,
  listings,
  soldListings,
  savedKeys,
  likedKeys,
  signedIn,
  userEmail,
  displayPrefs,
}: Props) {
  const { downPaymentPercent, interestRate, loanTermYears } = displayPrefs

  return (
    <section className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="neighborhood-listings-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="neighborhood-listings-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          Homes for Sale in {neighborhoodName}
        </h2>
        <p className="mt-1 text-[var(--text-secondary)]">{listings.length} active listings</p>
        {listings.length === 0 ? (
          <div className="mt-8 rounded-xl border border-[var(--gray-border)] bg-white p-8 text-center">
            <p className="text-[var(--text-secondary)]">
              No active listings in {neighborhoodName} right now. Save a search to get notified when new homes hit the market.
            </p>
            <Link
              href="/account/saved-searches"
              className="mt-4 inline-block rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
            >
              {signedIn ? 'Save a search' : 'Sign in to save'}
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {listings.map((listing) => {
              const key = listing.ListingKey ?? listing.ListNumber ?? ''
              const monthly = estimatedMonthlyPayment(
                listing.ListPrice ?? 0,
                downPaymentPercent,
                interestRate,
                loanTermYears
              )
              return (
                <HomeTileCard
                  key={String(key)}
                  listing={listing as import('@/app/actions/listings').HomeTileRow}
                  listingKey={String(key)}
                  monthlyPayment={formatMonthlyPayment(monthly)}
                  saved={signedIn && savedKeys.includes(String(key))}
                  liked={signedIn && likedKeys.includes(String(key))}
                  signedIn={signedIn}
                  userEmail={userEmail}
                />
              )
            })}
          </div>
        )}
        {soldListings.length > 0 && (
          <div className="mt-12">
            <h3 className="text-xl font-bold text-[var(--brand-navy)]">
              Recently Sold in {neighborhoodName}
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {soldListings.map((listing) => {
                const key = listing.ListingKey ?? listing.ListNumber ?? ''
                return (
                  <Link
                    key={String(key)}
                    href={`/listing/${key}`}
                    className="rounded-xl border border-[var(--gray-border)] bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <p className="font-semibold text-[var(--brand-navy)]">
                      {[listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ')} {listing.City}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Sold {formatPrice(listing.ClosePrice)} · {formatDate(listing.CloseDate)}
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
        <div className="mt-6">
          <Link
            href={`/search/${encodeURIComponent(citySlug)}`}
            className="inline-flex items-center font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            View all listings in this city →
          </Link>
        </div>
      </div>
    </section>
  )
}
