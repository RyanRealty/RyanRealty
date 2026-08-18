/**
 * Alias-aware public figures for non-resort registry communities whose MLS
 * tags are a Crr-style family. Parallel to getRegistryResortPublicFigures.
 * Does not change cityResorts() membership.
 *
 * Empty tile fetch → empty map. Do not overlay zeros from a timed-out read.
 */
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { medianListPriceOfTiles } from '@/lib/market/tile-medians'
import {
  publishResortIndexFigures,
  registryResortOverlayKeys,
} from '@/lib/market/publish-resort-index-figures'
import {
  communityAliasTilesForEntry,
  registryEntryUsesMlsAliasScan,
} from '@/lib/market/publish-community-mls-aliases'
import { fetchAllCityActiveSfr } from '@/lib/kb/city-active-sfr'
import type { ListingTile } from '@/lib/data'

export type RegistryAliasPublicFigures = {
  activeCount: number
  medianListPrice: number | null
}

type RegistryRow = {
  slug: string
  label?: string
  city: string
  city_slug: string
  is_resort?: boolean
  mls_cities?: string[]
  subdivision_aliases?: string[]
}

async function loadRegistryAliasPublicFigures(): Promise<Record<string, RegistryAliasPublicFigures>> {
  const entries = (resortRegistry.communities as RegistryRow[]).filter((row) =>
    registryEntryUsesMlsAliasScan(row),
  )
  const cityNames = new Set<string>()
  for (const entry of entries) {
    cityNames.add(entry.city)
    for (const extra of entry.mls_cities ?? []) cityNames.add(extra)
  }
  const tilesByCity = new Map<string, Awaited<ReturnType<typeof fetchAllCityActiveSfr>>>()
  await Promise.all(
    [...cityNames].map(async (city) => {
      tilesByCity.set(city, await fetchAllCityActiveSfr(city))
    }),
  )
  if ([...tilesByCity.values()].every((rows) => rows.length === 0)) return {}

  const out: Record<string, RegistryAliasPublicFigures> = {}
  for (const entry of entries) {
    const citySet = [entry.city, ...(entry.mls_cities ?? [])]
    const byKey = new Map<string, ListingTile>()
    for (const city of citySet) {
      for (const tile of tilesByCity.get(city) ?? []) byKey.set(tile.listingKey, tile)
    }
    const tiles = communityAliasTilesForEntry(entry, [...byKey.values()])
    const published = publishResortIndexFigures({
      aliasAwareCount: tiles.length,
      aliasAwareMedian: medianListPriceOfTiles(tiles),
    })
    if (published.activeCount == null) continue
    const figures = {
      activeCount: published.activeCount,
      medianListPrice: published.medianListPrice,
    }
    for (const key of registryResortOverlayKeys({
      slug: entry.slug,
      citySlug: entry.city_slug,
      label: entry.label,
    })) {
      out[key] = figures
    }
  }
  return out
}

const cached = unstable_cache(loadRegistryAliasPublicFigures, ['registry-alias-public-figures-v1'], {
  revalidate: 900,
  tags: ['communities-index', 'community-detail'],
})

export const getRegistryAliasPublicFigures = cache(async () => {
  const rows = await cached()
  return new Map(Object.entries(rows))
})
