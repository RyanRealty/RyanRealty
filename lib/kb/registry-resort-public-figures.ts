/**
 * Alias-aware public figures for every `is_resort` registry community.
 *
 * Same tile set the community page uses (`fetchAllCityActiveSfr` +
 * `resortActiveSfrCounts` / `resortTilesForSlug`). Index tiles, homepage
 * cards, and getCommunityBySlug metadata must overlay these so they cannot
 * disagree with /communities/{slug}.
 *
 * Empty tile fetch → empty map. Do not overlay zeros from a timed-out read.
 */
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
import { publishResortIndexFigures } from '@/lib/market/publish-resort-index-figures'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import { resortActiveSfrCounts, resortTilesForSlug } from '@/lib/kb/resort-active-counts'
import type { ListingTile } from '@/lib/data'

export type RegistryResortPublicFigures = {
  activeCount: number
  medianListPrice: number | null
}

type RegistryRow = {
  slug: string
  city: string
  city_slug: string
  is_resort?: boolean
  mls_cities?: string[]
}

async function loadRegistryResortPublicFigures(): Promise<
  Record<string, RegistryResortPublicFigures>
> {
  const resorts = (resortRegistry.communities as RegistryRow[]).filter((c) => c.is_resort === true)
  const cityNames = new Set<string>()
  for (const r of resorts) {
    cityNames.add(r.city)
    for (const extra of r.mls_cities ?? []) cityNames.add(extra)
  }
  const tilesByCity = new Map<string, Awaited<ReturnType<typeof fetchAllCityActiveSfr>>>()
  await Promise.all(
    [...cityNames].map(async (city) => {
      tilesByCity.set(city, await fetchAllCityActiveSfr(city))
    }),
  )
  if ([...tilesByCity.values()].every((rows) => rows.length === 0)) return {}

  const out: Record<string, RegistryResortPublicFigures> = {}
  for (const resort of resorts) {
    // Same city door as /communities/{slug}: registry city + mls_cities only.
    // A global pile lets generic aliases (Tetherow "Triple") count homes in
    // other cities and disagree with the place page (48 vs 35).
    const citySet = [resort.city, ...(resort.mls_cities ?? [])]
    const byKey = new Map<string, ListingTile>()
    for (const city of citySet) {
      for (const tile of tilesByCity.get(city) ?? []) byKey.set(tile.listingKey, tile)
    }
    const tiles = [...byKey.values()]
    const published = publishResortIndexFigures({
      aliasAwareCount: resortActiveSfrCounts(resort.city_slug, tiles).get(resort.slug) ?? 0,
      aliasAwareMedian: medianListPriceOfTiles(resortTilesForSlug(resort.city_slug, resort.slug, tiles)),
    })
    if (published.activeCount == null) continue
    const figures = {
      activeCount: published.activeCount,
      medianListPrice: published.medianListPrice,
    }
    // Registry URLs use the bare slug (`tetherow`). Index rows use the
    // city-prefixed entity slug (`bend-tetherow`). Key both so homepage
    // tiles and the A-Z list cannot miss the overlay.
    out[resort.slug] = figures
    const cityPrefixed = `${resort.city_slug}-${resort.slug}`
    if (cityPrefixed !== resort.slug) out[cityPrefixed] = figures
  }
  return out
}

const cached = unstable_cache(loadRegistryResortPublicFigures, ['registry-resort-public-figures-v3'], {
  revalidate: 900,
  tags: ['communities-index', 'community-detail'],
})

export const getRegistryResortPublicFigures = cache(async () => {
  const rows = await cached()
  return new Map(Object.entries(rows))
})
