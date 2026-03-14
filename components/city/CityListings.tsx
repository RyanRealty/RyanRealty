'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { CityListingRow } from '@/app/actions/cities'
import HomeTileCard from '@/components/home/HomeTileCard'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type SoldListing = CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null }

type DisplayPrefs = {
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

type SortKey = 'newest' | 'price_asc' | 'price_desc'

type Props = {
  cityName: string
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

export default function CityListings({
  cityName,
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
  const [sort, setSort] = useState<SortKey>('newest')
  const sortedListings = useMemo(() => {
    const arr = [...listings]
    if (sort === 'price_asc') arr.sort((a, b) => (a.ListPrice ?? 0) - (b.ListPrice ?? 0))
    else if (sort === 'price_desc') arr.sort((a, b) => (b.ListPrice ?? 0) - (a.ListPrice ?? 0))
    return arr
  }, [listings, sort])

  return (
    <section className="bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-listings-heading">
      <div className="mx-auto max-w-7xl">
        {listings.length === 0 ? (
          <>
            <h2 id="city-listings-heading" className="text-2xl font-bold tracking-tight text-primary">
              Homes for Sale in {cityName}
            </h2>
            <Card className="mt-8">
              <CardContent className="pt-8 text-center">
                <p className="text-muted-foreground">
                  No active listings in {cityName} right now. Save a search to get notified when new homes hit the market.
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
            title={`Homes for Sale in ${cityName}`}
            subtitle={`${listings.length} active listings`}
            titleId="city-listings-heading"
            headerRight={
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="city-listings-sort" className="text-sm text-muted-foreground">
                  Sort:
                </Label>
                <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                  <SelectTrigger id="city-listings-sort" className="rounded border border-border bg-card px-3 py-2 text-sm text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price_asc">Price (low to high)</SelectItem>
                    <SelectItem value="price_desc">Price (high to low)</SelectItem>
                  </SelectContent>
                </Select>
                <Link
                  href={`/homes-for-sale/${encodeURIComponent(citySlug)}`}
                  className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
                >
                  View all
                </Link>
              </div>
            }
          >
            {sortedListings.map((listing) => {
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
              title={`Recently Sold in ${cityName}`}
              titleId="city-sold-heading"
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
      </div>
    </section>
  )
}
