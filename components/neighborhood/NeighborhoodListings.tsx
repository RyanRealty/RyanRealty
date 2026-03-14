'use client'

import Link from 'next/link'
import type { CityListingRow } from '@/app/actions/cities'
import HomeTileCard from '@/components/home/HomeTileCard'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="neighborhood-listings-heading">
      <div className="mx-auto max-w-7xl">
        {listings.length === 0 ? (
          <>
            <h2 id="neighborhood-listings-heading" className="text-2xl font-bold tracking-tight text-primary">
              Homes for Sale in {neighborhoodName}
            </h2>
            <Card className="mt-8">
              <CardContent className="pt-8 text-center">
                <p className="text-muted-foreground">
                  No active listings in {neighborhoodName} right now. Save a search to get notified when new homes hit the market.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/account/saved-searches">
                    {signedIn ? 'Save a search' : 'Sign in to save'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <TilesSlider
            title={`Homes for Sale in ${neighborhoodName}`}
            subtitle={`${listings.length} active listings`}
            titleId="neighborhood-listings-heading"
            headerRight={
              <Link
                href={`/homes-for-sale/${encodeURIComponent(citySlug)}`}
                className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
              >
                View all in city →
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
                <TilesSliderItem key={String(key)} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
                  <HomeTileCard
                    listing={listing as import('@/app/actions/listings').HomeTileRow}
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
        )}
        {soldListings.length > 0 && (
          <div className="mt-12">
            <TilesSlider
              title={`Recently Sold in ${neighborhoodName}`}
              titleId="neighborhood-sold-heading"
            >
              {soldListings.map((listing) => {
                const key = listing.ListingKey ?? listing.ListNumber ?? ''
                return (
                  <TilesSliderItem key={String(key)} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
                    <Link
                      href={`/listing/${key}`}
                      className="block h-full rounded-lg border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
                    >
                      <p className="font-semibold text-primary">
                        {[listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ')} {listing.City}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sold {formatPrice(listing.ClosePrice)} · {formatDate(listing.CloseDate)}
                      </p>
                    </Link>
                  </TilesSliderItem>
                )
              })}
            </TilesSlider>
          </div>
        )}
        <div className="mt-6">
          <Link
            href={`/homes-for-sale/${encodeURIComponent(citySlug)}`}
            className="inline-flex items-center font-medium text-accent-foreground hover:text-accent-foreground"
          >
            View all listings in this city →
          </Link>
        </div>
      </div>
    </section>
  )
}
