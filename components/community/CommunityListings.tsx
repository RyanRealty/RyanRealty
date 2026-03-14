'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ListingRow } from '@/app/actions/communities'
import HomeTileCard from '@/components/home/HomeTileCard'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { toggleSavedCommunity } from '@/app/actions/saved-communities'
import { subdivisionEntityKey } from '@/lib/slug'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from '@/components/ui/card'

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
    <section className="bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="community-listings-heading">
      <div className="mx-auto max-w-7xl">
        {listings.length === 0 ? (
          <>
            <h2 id="community-listings-heading" className="text-2xl font-bold tracking-tight text-primary">
              Homes for Sale in {communityName}
            </h2>
            <Card className="mt-8">
              <CardContent className="pt-8 text-center">
                <p className="text-muted-foreground">
                  No active listings in {communityName} right now. Save this community to get notified when new listings appear.
                </p>
                {signedIn && (
                  <Button
                    type="button"
                    onClick={handleSaveCommunity}
                    className="mt-4"
                  >
                    {savedCommunity ? 'Saved' : 'Save community'}
                  </Button>
                )}
                {!signedIn && (
                  <Button asChild className="mt-4">
                    <Link href="/account">
                      Sign in to save
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <TilesSlider
            title={`Homes for Sale in ${communityName}`}
            subtitle={`${listings.length} active listings`}
            titleId="community-listings-heading"
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
              title={`Recently Sold in ${communityName}`}
              titleId="community-sold-heading"
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
