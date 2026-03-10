'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ListingRow } from '@/app/actions/communities'
import HomeTileCard from '@/components/home/HomeTileCard'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { toggleSavedCommunity } from '@/app/actions/saved-communities'
import { subdivisionEntityKey } from '@/lib/slug'

const LISTING_PAGE_SIZE = 24

type SoldListing = ListingRow & { ClosePrice?: number | null; CloseDate?: string | null }

type DisplayPrefs = {
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

type Props = {
  communityName: string
  slug: string
  city: string
  subdivision: string
  listings: ListingRow[]
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

export default function CommunityListings({
  communityName,
  slug,
  city,
  subdivision,
  listings,
  soldListings,
  savedKeys,
  likedKeys,
  signedIn,
  userEmail,
  displayPrefs,
}: Props) {
  const [savedCommunity, setSavedCommunity] = useState(false)
  const entityKey = subdivisionEntityKey(city, subdivision)

  async function handleSaveCommunity() {
    if (!signedIn) return
    const result = await toggleSavedCommunity(entityKey)
    if (result.error == null) setSavedCommunity(result.saved)
  }

  const { downPaymentPercent, interestRate, loanTermYears } = displayPrefs

  return (
    <section className="bg-white px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="community-listings-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="community-listings-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          Homes for Sale in {communityName}
        </h2>
        <p className="mt-1 text-[var(--text-secondary)]">{listings.length} active listings</p>
        {listings.length === 0 ? (
          <div className="mt-8 rounded-xl border border-[var(--gray-border)] bg-[var(--gray-bg)] p-8 text-center">
            <p className="text-[var(--text-secondary)]">
              No active listings in {communityName} right now. Save this community to get notified when new listings appear.
            </p>
            {signedIn && (
              <button
                type="button"
                onClick={handleSaveCommunity}
                className="mt-4 rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
              >
                {savedCommunity ? 'Saved' : 'Save community'}
              </button>
            )}
            {!signedIn && (
              <Link href="/account" className="mt-4 inline-block rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]">
                Sign in to save
              </Link>
            )}
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
              Recently Sold in {communityName}
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
      </div>
    </section>
  )
}
