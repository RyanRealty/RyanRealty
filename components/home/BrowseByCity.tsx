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
 * Browse by city section: single-row slider of city tiles (same as /cities: image, share, save).
 */
export default function BrowseByCity({ cities, savedSlugs, signedIn }: Props) {
  if (cities.length === 0) return null
  const savedSet = new Set(savedSlugs.map((s) => s.toLowerCase()))

  return (
    <section className="w-full bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="browse-city-heading">
      <div className="mx-auto w-full max-w-7xl">
        <TilesSlider
          title="Browse by city"
          subtitle="Explore listings in Central Oregon cities."
          titleId="browse-city-heading"
          headerRight={
            <Link
              href="/cities"
              className="text-sm font-semibold text-accent-foreground hover:text-accent-foreground"
            >
              Browse all →
            </Link>
          }
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
        </TilesSlider>
      </div>
    </section>
  )
}
