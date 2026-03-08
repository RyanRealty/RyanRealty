'use client'

import Link from 'next/link'
import { cityEntityKey } from '@/lib/slug'
import ShareButton from '@/components/ShareButton'

export type CityTileProps = {
  city: string
  count: number
}

/**
 * Single city tile for "Browse by city" and grids. Same options as other tiles: share. Min height for alignment.
 */
export default function CityTile({ city, count }: CityTileProps) {
  const href = `/search/${cityEntityKey(city)}`

  return (
    <div className="relative flex min-h-[120px] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow">
      <Link href={href} className="flex flex-1 flex-col px-4 py-3 pr-12 text-sm font-medium text-zinc-700">
        <span className="block truncate">{city}</span>
        <span className="mt-0.5 block text-xs text-zinc-400">{count} listings</span>
      </Link>
      <div
        className="absolute right-2 top-2 z-10"
        onClick={(e) => e.preventDefault()}
      >
        <ShareButton
          url={typeof window !== 'undefined' ? `${window.location.origin}${href}` : undefined}
          title={`Homes for sale in ${city}`}
          variant="compact"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 p-0 hover:bg-zinc-200"
          aria-label={`Share ${city}`}
        />
      </div>
    </div>
  )
}
