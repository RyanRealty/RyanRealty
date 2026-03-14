'use client'

import type { CityForIndex } from '@/lib/cities'
import CityTile from '@/components/CityTile'

type Props = {
  cities: CityForIndex[]
  savedSlugs: string[]
  signedIn: boolean
}

/** Grid of city tiles (same card everywhere). */
export default function CityTilesGrid({ cities, savedSlugs, signedIn }: Props) {
  const savedSet = new Set(savedSlugs.map((s) => s.toLowerCase()))
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((city) => (
        <CityTile
          key={city.slug}
          city={city}
          signedIn={signedIn}
          saved={savedSet.has(city.slug.toLowerCase())}
        />
      ))}
    </div>
  )
}
