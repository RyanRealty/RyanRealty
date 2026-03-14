'use client'

import { useState } from 'react'
import Link from 'next/link'
import UnifiedMapListingsView from '@/components/UnifiedMapListingsView'
import SearchFilterBar from '@/components/SearchFilterBar'
import type { ListingTileRow } from '@/app/actions/listings'
import { Button } from "@/components/ui/button"

type Props = {
  /** Initial listings so the map shows markers on first paint (Bend area). */
  initialListings?: ListingTileRow[]
  /** Total count for initial area (e.g. "752 results in this area"). */
  initialTotalCount?: number
  /** GeoJSON boundary for Bend to draw on the map. */
  boundaryGeojson?: unknown
  savedKeys?: string[]
  likedKeys?: string[]
  signedIn?: boolean
  userEmail?: string | null
  prefs?: { downPaymentPercent?: number; interestRate?: number; loanTermYears?: number } | null
}

/**
 * Home page "Explore on map" section. Collapsible (Show map / Hide map) per HOME_PAGE_BEST_PRACTICES.
 * Uses the same bounds-driven map as /listings?view=map: list left, map right, price markers + clustering.
 */
export default function HomeExploreMap({
  initialListings = [],
  initialTotalCount = 0,
  boundaryGeojson = null,
  savedKeys = [],
  likedKeys = [],
  signedIn = false,
  userEmail = null,
  prefs = null,
}: Props) {
  const [open, setOpen] = useState(false)
  const hasApiKey =
    typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'string' &&
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.length > 0

  if (!hasApiKey) {
    return (
      <section
        className="w-full border-b border-border bg-muted px-4 py-8 sm:px-6"
        aria-labelledby="home-explore-map-heading"
      >
        <h2 id="home-explore-map-heading" className="text-xl font-semibold text-primary">
          Explore on map
        </h2>
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-8 text-center">
          <p className="text-warning">
            Configure <code className="rounded bg-warning/15 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your
            environment to show the map.
          </p>
          <Link
            href="/listings?view=map"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary/90"
          >
            Browse listings
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section
      className="w-full border-b border-border bg-muted"
      aria-labelledby="home-explore-map-heading"
    >
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-2 sm:px-6">
        <Button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3.5 text-left text-base font-semibold text-primary shadow-sm hover:bg-muted transition-colors"
          aria-expanded={open}
          aria-controls="home-explore-map-content"
          id="home-explore-map-heading"
        >
          <span>Explore on map</span>
          <span className="text-sm font-normal text-muted-foreground" aria-hidden>
            {open ? 'Hide map' : 'Show map'}
          </span>
        </Button>
      </div>
      <div
        id="home-explore-map-content"
        role="region"
        aria-labelledby="home-explore-map-heading"
        className={`overflow-hidden transition-all duration-200 ${open ? 'visible opacity-100' : 'invisible h-0 opacity-0'}`}
      >
        {open && (
          <>
            <div className="mx-auto max-w-7xl mt-4 h-[72vh] flex flex-col min-h-0 overflow-hidden px-4 pb-4 sm:px-6">
              <UnifiedMapListingsView
                pageTitle="Bend OR Real Estate & Homes For Sale"
                basePath="/listings"
                placeQuery="Bend Oregon"
                city="Bend"
                boundaryGeojson={boundaryGeojson}
                initialListings={initialListings}
                initialTotalCount={initialTotalCount}
                savedKeys={savedKeys}
                likedKeys={likedKeys}
                priceChangeKeys={new Set()}
                signedIn={signedIn}
                userEmail={userEmail}
                prefs={prefs}
                containerClassName="h-full min-h-0 flex-1 rounded-lg border border-border bg-card shadow-sm overflow-hidden"
                filterBar={
                  <SearchFilterBar
                    basePath="/listings"
                    locationLabel="Bend OR"
                    locationHref="/homes-for-sale/bend?view=map"
                    signedIn={signedIn}
                    view="map"
                  />
                }
              />
            </div>
            <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-center border-t border-border bg-card px-4 py-4 sm:px-6">
              <Link
                href="/listings?view=map"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary/90"
              >
                Explore on map →
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
