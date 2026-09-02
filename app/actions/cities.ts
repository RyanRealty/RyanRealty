'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { slugify } from '@/lib/slug'
import type { CityForIndex } from '@/lib/cities'
import { getBannersBatch } from '@/app/actions/banners'
import {
  getBrowseCities,
  getCityFromSlug,
} from '@/app/actions/listings'
import type { CommunityForIndex } from '@/lib/communities'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import { isResidentialInventoryType } from '@/lib/inventory-filters'
import { getSubdivisionBoundarySlugs } from '@/lib/data/subdivisions/getSubdivisionBoundarySlugs'
import { getResortCommunityBySubdivisionName } from '@/lib/data/communities/registry'
import { withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { getResortCommunityImage } from '@/lib/resort-community-images'
import {
  getAllCitySnapshots,
  getGeoSnapshot,
  getCityListings as getCityListingsDAL,
  getListingTiles as getListingTilesDAL,
} from '@/lib/data'
import type { ListingTile } from '@/lib/data'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

function normalizeBannerLikeUrl(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  const marker = '/storage/v1/object/public/banners/'
  const markerIndex = raw.indexOf(marker)
  if (markerIndex >= 0) {
    const tail = raw.slice(markerIndex + marker.length)
    if (tail.startsWith('http://') || tail.startsWith('https://')) return tail
  }
  return raw
}

export type CityListingRow = {
  ListingKey: string | null
  ListNumber?: string | null
  mls_source?: string | null
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  StreetNumber: string | null
  StreetName: string | null
  StreetSuffix?: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
  StandardStatus?: string | null
  TotalLivingAreaSqFt?: number | null
  ListOfficeName?: string | null
  ListAgentName?: string | null
  OnMarketDate?: string | null
  CloseDate?: string | null
  OpenHouses?: unknown
  has_virtual_tour?: boolean | null
  lot_size_acres?: number | null
  lot_size_sqft?: number | null
}

/**
 * All cities for the cities index page.
 *
 * Reads pre-aggregated counts + medians from geo_snapshot_mv via the DAL
 * (`getAllCitySnapshots`) — replaces the prior fetchAllRows path that
 * scanned 60K active rows on every cold cache hit. The MV refreshes every
 * 15 min via /api/cron/refresh-mvs, so the data is at most 15 min stale.
 */
async function _getCitiesForIndexUncached(): Promise<CityForIndex[]> {
  const sb = supabase()

  // DAL: pre-aggregated city snapshots from geo_snapshot_mv
  const [browse, snapshots] = await Promise.all([
    getBrowseCities(),
    getAllCitySnapshots(),
  ])

  // Index snapshots by lower-cased city name for the lookup below.
  const byCity = new Map<string, { count: number | null; medianPrice: number | null; communityCount: number }>()
  for (const snap of snapshots) {
    byCity.set(snap.geoKey, {
      count: snap.activeSfrCount,
      medianPrice: snap.medianListPrice != null ? Math.round(snap.medianListPrice) : null,
      communityCount: snap.communityCount,
    })
  }

  const allSlugs = browse.map(({ City }) => slugify(City))
  const allCityNames = browse.map(({ City }) => City)

  const { getCityMetadataByNames } = await import('@/lib/data')
  const [bannerMap, cityMetaByName] = await Promise.all([
    getBannersBatch('city', allSlugs),
    getCityMetadataByNames(allCityNames),
  ])
  void sb

  const result: CityForIndex[] = []
  for (const { City: name, count } of browse) {
    const rec = byCity.get(name.toLowerCase())
    // Snapshot present with null count is unknown, not the browse polygon fallback.
    const activeCount = rec ? rec.count : count
    const medianPrice = rec?.medianPrice ?? null
    const communityCount = rec?.communityCount ?? 0
    const slug = slugify(name)
    const banner = bannerMap.get(slug)
    const db = cityMetaByName.get(name.toLowerCase()) ?? null
    result.push({
      slug,
      name,
      activeCount,
      medianPrice,
      communityCount,
      heroImageUrl: normalizeBannerLikeUrl(db?.hero_image_url ?? null) ?? banner?.url ?? null,
      description: db?.description ?? null,
    })
  }
  result.sort((a, b) => {
    const av = a.activeCount
    const bv = b.activeCount
    if (av == null && bv == null) return a.name.localeCompare(b.name)
    if (av == null) return 1
    if (bv == null) return -1
    return bv - av || a.name.localeCompare(b.name)
  })
  return result
}

// v6 2026-08-23 — inventory overlay (active_count) even when MOS is below min_n.
// v5 city MT miss nulls published inventory. v4 overlay on hit.
export const getCitiesForIndex = unstable_cache(
  _getCitiesForIndexUncached,
  ['cities-index-v6-mt-inventory'],
  { revalidate: 1800, tags: ['cities-index'] }
)

/** Neighborhood detail for detail page: resolve by city slug + neighborhood slug. */
export type NeighborhoodDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  seoTitle: string | null
  seoDescription: string | null
  heroImageUrl: string | null
  boundaryGeojson: unknown
  cityId: string
  cityName: string
  citySlug: string
  activeCount: number
  medianPrice: number | null
}

async function _getNeighborhoodBySlugUncached(
  citySlug: string,
  neighborhoodSlug: string
): Promise<NeighborhoodDetail | null> {
  const cityName = await getCityFromSlug(citySlug)
  if (!cityName) return null
  const { getCityIdByName, getNeighborhoodBySlugInCity } = await import('@/lib/data')
  const cityId = await getCityIdByName(cityName)
  if (!cityId) return null
  const n = await getNeighborhoodBySlugInCity(cityId, neighborhoodSlug)
  if (!n) return null
  // DAL: count + median active tiles for the neighborhood via listing_tile_mv.
  const tiles = await getListingTilesDAL({
    neighborhood: n.name,
    status: 'active',
    limit: 5000,
  })
  const filteredTiles = tiles.filter((t) => isResidentialInventoryType(t.propertyType ?? null))
  const activeCount = filteredTiles.length
  const prices = filteredTiles
    .map((t) => Number(t.listPrice))
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b)
  let medianPrice: number | null = null
  if (prices.length > 0) {
    const mid = Math.floor(prices.length / 2)
    medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
  }
  return {
    id: n.id,
    name: n.name,
    slug: n.slug,
    description: n.description ?? null,
    seoTitle: n.seo_title ?? null,
    seoDescription: n.seo_description ?? null,
    heroImageUrl: n.hero_image_url ?? null,
    boundaryGeojson: n.boundary_geojson ?? null,
    cityId,
    cityName,
    citySlug,
    activeCount,
    medianPrice,
  }
}

export const getNeighborhoodBySlug = unstable_cache(
  _getNeighborhoodBySlugUncached,
  // v2 (design-audit #132): isResidentialInventoryType() previously never
  // matched listing_tile_mv's raw single-letter PropertyType codes, so land
  // parcels (D) counted toward this fn's activeCount/medianPrice — evicts
  // any v1 entry cached with the wrong numbers.
  ['neighborhood-by-slug-v2'],
  { revalidate: 300, tags: ['neighborhood-detail'] }
)

/** Boundary GeoJSON for a city (for map overlay on city/community search). Returns null if not found. */
export async function getCityBoundary(cityName: string): Promise<unknown | null> {
  if (!cityName?.trim()) return null
  const { getCityBoundaryGeoJSON } = await import('@/lib/data')
  return getCityBoundaryGeoJSON(cityName)
}

/** Communities (subdivisions) within a specific neighborhood. */
export async function getCommunitiesInNeighborhood(neighborhoodId: string, cityName: string): Promise<CommunityForIndex[]> {
  const sb = supabase()
  void sb
  const { getCommunitiesInNeighborhoodLite } = await import('@/lib/data')
  const [flags, communityRows] = await Promise.all([
    listSubdivisionsWithFlags(),
    getCommunitiesInNeighborhoodLite(neighborhoodId),
  ])

  if (communityRows.length === 0) return []

  // DAL: pull active tiles for the city once, bin by subdivision in-memory for
  // the named communities. Avoids the SubdivisionName IN-clause directly
  // against listings.
  const communityNames = communityRows.map((c) => c.name)
  const communityNamesLower = new Set(communityNames.map((n) => n.toLowerCase()))
  const cityTilesForBin = await getCityListingsDAL(cityName, {
    status: 'active',
    sort: 'newest',
    limit: 5000,
  })

  // SFR-only, matching BOTH the page's printed trace ("active single-family
  // listings, counted per place") and the destination plat page's counted set
  // (getPlatPublicInventory: property_sub_type='Single Family Residence').
  // The old residential-bucket bin advertised "1 active" for plats whose page
  // then served the refusal — the Pettigrew Place dead end (2026-09-01).
  // Keyed lowercased so an MLS spelling-case variant still bins to its card.
  const bySub = new Map<string, number[]>()
  for (const t of cityTilesForBin) {
    if (t.propertySubType !== 'Single Family Residence') continue
    const sub = (t.subdivisionName ?? '').trim()
    if (!sub || sub.toLowerCase() === 'n/a') continue
    if (!communityNamesLower.has(sub.toLowerCase())) continue
    const arr = bySub.get(sub.toLowerCase()) ?? []
    const p = Number(t.listPrice)
    if (Number.isFinite(p) && p > 0) arr.push(p)
    bySub.set(sub.toLowerCase(), arr)
  }

  const resortSet = new Set(
    (await import('@/app/actions/subdivision-flags').then((m) => m.getResortEntityKeys()))
  )
  const entityKey = (c: string, s: string) => `${slugify(c)}:${slugify(s)}`
  const entityKeys = communityRows.map((comm) => entityKey(cityName, comm.name))
  const bannerMap = await getBannersBatch('subdivision', entityKeys)

  // A card may only advertise a destination that will render. The plat page
  // resolves through exactly three paths (GIS boundary, registry alias, SFR
  // actives) and refuses otherwise — a card for an unresolvable plat is a
  // guaranteed "No subdivision at this address" dead end, so it is dropped
  // here rather than dressed up. Boundary read is timeout-guarded: if it did
  // not answer, every card stays (§0 — a degraded read must not delete rows).
  const boundaryRead = await withTimeoutFallbackResult(getSubdivisionBoundarySlugs(), [], 3500, 'nbh:plat-boundaries')
  const boundarySlugSet = new Set(boundaryRead.value)
  const platResolves = (name: string, sfrActives: number): boolean => {
    // Empty set = failed read, never a real answer: the underlying fetch
    // throws on 0 rows (3,213 plats exist), so makeResilientCached's []
    // fallback is only reachable on failure. Unknown must not delete cards.
    if (!boundaryRead.ok || boundarySlugSet.size === 0) return true
    if (sfrActives > 0) return true
    if (boundarySlugSet.has(slugify(name))) return true
    return getResortCommunityBySubdivisionName(name) != null
  }

  const result: CommunityForIndex[] = []
  for (const comm of communityRows) {
    const prices = bySub.get(comm.name.toLowerCase()) ?? []
    if (!platResolves(comm.name, prices.length)) continue
    prices.sort((a, b) => a - b)
    const medianPrice =
      prices.length === 0
        ? null
        : prices.length % 2
          ? prices[Math.floor(prices.length / 2)]!
          : Math.round((prices[prices.length / 2 - 1]! + prices[prices.length / 2]!) / 2)

    const key = entityKey(cityName, comm.name)
    const isResort = flags.some((f) => f.entity_key === key && f.is_resort) || resortSet.has(key)
    const heroUrl = comm.hero_image_url ?? bannerMap.get(key)?.url ?? null
    const resortHeroUrl = isResort ? getResortCommunityImage(cityName, comm.name) : null

    result.push({
      slug: comm.slug,
      entityKey: key,
      city: cityName,
      subdivision: comm.name,
      activeCount: prices.length,
      medianPrice,
      heroImageUrl: heroUrl ?? resortHeroUrl ?? null,
      isResort,
    })
  }
  // Liveliest first: the neighborhood page caps this ledger at 12 cards, so an
  // unsorted list buried the subdivisions with active homes under empty ones.
  result.sort(
    (a, b) => (b.activeCount ?? 0) - (a.activeCount ?? 0) || a.subdivision.localeCompare(b.subdivision)
  )
  return result
}
