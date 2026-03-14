'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { MapListingRow } from '@/app/actions/listings'
import { Button } from "@/components/ui/button"

const HomeMap = dynamic(() => import('./HomeMap'), {
  ssr: false,
  loading: () => (
    <div
      className="flex w-full items-center justify-center border-0 border-b border-border bg-muted text-foreground"
      style={{ minHeight: '400px' }}
    >
      Loading map…
    </div>
  ),
})

/**
 * Collapsible "Explore on map" section below the hero.
 * Renders a real interactive map (lazy-loaded) with active listings; expanded by default so the map is visible.
 * Best practice: map script loads only when this section is in the tree (dynamic import), centered on Central Oregon with pins.
 */
type Props = {
  mapListings?: MapListingRow[]
}

export default function ExploreOnMap({ mapListings = [] }: Props) {
  const [open, setOpen] = useState(true)

  const hasApiKey = typeof process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'string' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.length > 0

  return (
    <section
      className="w-full border-b border-border bg-muted"
      aria-labelledby="explore-map-heading"
    >
      <div className="w-full px-4 py-4 sm:px-6">
        <Button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 text-left font-medium text-foreground transition hover:bg-muted"
          aria-expanded={open}
          aria-controls="explore-map-content"
          id="explore-map-heading"
        >
          <span>Explore on map</span>
          <span className="text-muted-foreground" aria-hidden>
            {open ? 'Hide map' : 'Show map'}
          </span>
        </Button>
        <div
          id="explore-map-content"
          role="region"
          aria-labelledby="explore-map-heading"
          className={`overflow-hidden border-0 bg-card transition-all duration-200 ${
            open ? 'visible opacity-100' : 'invisible h-0 opacity-0'
          }`}
        >
          {open && (
            <div className="w-full p-4">
              {hasApiKey ? (
                <>
                  <HomeMap listings={mapListings} />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground">
                      {mapListings.length > 0
                        ? `${mapListings.length} active listings shown. Pan and zoom to explore.`
                        : 'No listings with location data yet. Use the full map to search.'}
                    </p>
                    <Link
                      href="/listings?view=map"
                      className="inline-flex items-center justify-center bg-accent px-5 py-2.5 font-semibold text-accent-foreground hover:bg-accent/90"
                    >
                      Full map & filters →
                    </Link>
                  </div>
                </>
              ) : (
                <div className="border border-warning/30 bg-warning/10 px-4 py-8 text-center">
                  <p className="text-warning">
                    Configure <code className="bg-warning/15 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> in your
                    environment to show the map.
                  </p>
                  <Link
                    href="/listings?view=map"
                    className="mt-4 inline-flex items-center justify-center bg-accent px-5 py-2.5 font-semibold text-accent-foreground"
                  >
                    Browse listings →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
