'use client'

import Link from 'next/link'
import type { CityForIndex } from '@/lib/cities'
import CityTile from '@/components/CityTile'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

type Props = {
  cities: CityForIndex[]
  savedSlugs: string[]
  signedIn: boolean
}

/**
 * Single-row slider of primary Central Oregon city tiles (same cards as /cities and Browse by city),
 * followed by a "See all cities" card linking to /cities.
 */
export default function ExploreByCitySlider({ cities, savedSlugs, signedIn }: Props) {
  const savedSet = new Set(savedSlugs.map((s) => s.toLowerCase()))

  return (
    <TilesSlider
      title="Explore by City"
      subtitle="Click any city to see neighborhoods, current listings, and local market insights."
      titleId="explore-heading"
      className="border-b border-border bg-card px-4 py-16 sm:px-6 sm:py-20"
    >
      {cities.map((city) => (
        <TilesSliderItem key={city.slug} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
          <CityTile
            city={city}
            signedIn={signedIn}
            saved={savedSet.has(city.slug.toLowerCase())}
          />
        </TilesSliderItem>
      ))}
      <TilesSliderItem style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
        <Link
          href="/cities"
          className="flex h-full min-h-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted p-6 text-center transition hover:border-accent hover:bg-card hover:shadow-sm"
          aria-label="See all cities"
        >
          <span className="text-4xl text-accent-foreground" aria-hidden>
            →
          </span>
          <span className="font-semibold text-primary">See all cities</span>
          <span className="text-sm text-muted-foreground">
            View every city in our coverage area
          </span>
        </Link>
      </TilesSliderItem>
    </TilesSlider>
  )
}
