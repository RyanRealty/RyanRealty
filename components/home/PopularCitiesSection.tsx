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
 * Home page Popular Cities slider: Bend, Redmond, Sunriver, Sisters, La Pine, Tumalo, Prineville, Madras.
 * Uses TilesSlider (arrows, no scrollbar) per UI guidelines.
 */
export default function PopularCitiesSection({ cities, savedSlugs, signedIn }: Props) {
  const savedSet = new Set(savedSlugs.map((s) => s.toLowerCase()))

  return (
    <TilesSlider
      title="Popular cities"
      subtitle="Bend, Redmond, Sunriver, Sisters, La Pine, Tumalo, Prineville, and Madras. Explore listings and market insights."
      titleId="popular-cities-heading"
      headerRight={
        <Link
          href="/cities"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          View all cities →
        </Link>
      }
      className="border-t border-border bg-card px-4 py-16 sm:px-6 sm:py-20"
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
          className="flex h-full min-h-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted p-6 text-center transition hover:border-accent hover:bg-card hover:shadow-sm"
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
