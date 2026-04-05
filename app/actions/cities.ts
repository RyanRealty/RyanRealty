'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { slugify } from '@/lib/slug'
import type { CityForIndex, CityDetail } from '@/lib/cities'
import { getBannerUrl, getBannersBatch } from '@/app/actions/banners'
import {
  getBrowseCities,
  getCityFromSlug,
} from '@/app/actions/listings'
import { getMarketStatsForCity } from '@/app/actions/market-stats'
import { getHotCommunitiesInCity } from '@/app/actions/listings'
import { entityKeyToSlug } from '@/lib/community-slug'
import type { CommunityForIndex } from '@/lib/communities'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import { isResidentialInventoryType } from '@/lib/inventory-filters'
import { getResortCommunityImage } from '@/lib/resort-community-images'

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

const ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'
const PENDING_OR =
  'StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%Contingent%'
const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, has_virtual_tour, lot_size_acres, lot_size_sqft, details'

export type CityListingRow = {
  ListingKey: string | null
  ListNumber?: string | null
  ListPrice: number | null
  BedroomsTotal: number | null
  BathroomsTotal: number | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  PhotoURL: string | null
  Latitude: number | null
  Longitude: number | null
  ModificationTimestamp?: string | null
  StandardStatus?: string | null
  TotalLivingAreaSqFt?: number | null
  ListOfficeName?: string | null
  ListAgentName?: string | null
  OnMarketDate?: string | null
  OpenHouses?: unknown
  has_virtual_tour?: boolean | null
  details?: unknown
  lot_size_acres?: number | null
  lot_size_sqft?: number | null
}

/** All cities for index with counts and median — uses RPC for single-scan aggregation instead of 60k row fetches. */
async function _getCitiesForIndexUncached(): Promise<CityForIndex[]> {
  const sb = supabase()

  // Legacy fallback: fetch from listings table directly
  const [browse, listingRows] = await Promise.all([
    getBrowseCities(),
    import('@/lib/supabase/paginate').then((m) =>
      m.fetchAllRows<{
        City?: string
        SubdivisionName?: string
        ListPrice?: number | null
        StandardStatus?: string | null
        PropertyType?: string | null
      }>(
        sb, 'listings', 'City, SubdivisionName, ListPrice, StandardStatus, PropertyType',
        (q: any) => q.or(ACTIVE_OR),
      )
    ),
  ])
  const byCity = new Map<string, { prices: number[]; subdivisions: Set<string>; count: number }>()
  for (const row of listingRows) {
    if (!isResidentialInventoryType(row.PropertyType ?? null)) continue
    const city = (row.City ?? '').toString().trim()
    if (!city) continue
    const rec = byCity.get(city) ?? { prices: [], subdivisions: new Set<string>(), count: 0 }
    rec.count += 1
    const p = Number(row.ListPrice)
    if (Number.isFinite(p) && p > 0) rec.prices.push(p)
    const sub = (row.SubdivisionName ?? '').toString().trim()
    if (sub && sub.toLowerCase() !== 'n/a') rec.subdivisions.add(sub)
    byCity.set(city, rec)
  }
  const allSlugs = browse.map(({ City }) => slugify(City))
  const allCityNames = browse.map(({ City }) => City)

  const [bannerMap, cityMetaRes] = await Promise.all([
    getBannersBatch('city', allSlugs),
    sb.from('cities').select('name, description, hero_image_url').in('name', allCityNames),
  ])

  const cityMetaByName = new Map<string, { description?: string | null; hero_image_url?: string | null }>()
  for (const row of (cityMetaRes.data ?? []) as { name: string; description?: string | null; hero_image_url?: string | null }[]) {
    cityMetaByName.set(row.name.toLowerCase(), row)
  }

  const result: CityForIndex[] = []
  for (const { City: name, count } of browse) {
    const rec = byCity.get(name)
    const activeCount = rec?.count ?? count
    let medianPrice: number | null = null
    if (rec && rec.prices.length > 0) {
      rec.prices.sort((a, b) => a - b)
      const mid = Math.floor(rec.prices.length / 2)
      medianPrice = rec.prices.length % 2
        ? rec.prices[mid]!
        : Math.round((rec.prices[mid - 1]! + rec.prices[mid]!) / 2)
    }
    const communityCount = rec?.subdivisions.size ?? 0
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
  result.sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))
  return result
}

export const getCitiesForIndex = unstable_cache(
  _getCitiesForIndexUncached,
  ['cities-index-v2'],
  { revalidate: 1800, tags: ['cities-index'] }
)

/** Get city by slug; returns null if not found. */
async function _getCityBySlugUncached(slug: string): Promise<CityDetail | null> {
  const cityName = await getCityFromSlug(slug)
  if (!cityName) return null
  const [stats, cityRow, activeRows] = await Promise.all([
    getMarketStatsForCity(cityName),
    supabase()
      .from('cities')
      .select('name, slug, description, hero_image_url')
      .ilike('name', cityName)
      .maybeSingle(),
    import('@/lib/supabase/paginate').then((m) =>
      m.fetchAllRows<{ SubdivisionName?: string | null; ListPrice?: number | null; PropertyType?: string | null }>(
        supabase(), 'listings', 'SubdivisionName, ListPrice, PropertyType',
        (q: any) => q.ilike('City', cityName).or(ACTIVE_OR),
      )
    ),
  ])
  const filteredRows = activeRows.filter((row) => isResidentialInventoryType(row.PropertyType ?? null))
  let activeCount = filteredRows.length
  if (activeCount === 0 && stats.count > 0) activeCount = stats.count
  const subs = filteredRows as { SubdivisionName?: string; ListPrice?: number | null }[]
  const prices = subs
    .map((row) => Number(row.ListPrice))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b)
  const medianFromRows =
    prices.length === 0
      ? null
      : prices.length % 2
        ? prices[Math.floor(prices.length / 2)]!
        : Math.round((prices[prices.length / 2 - 1]! + prices[prices.length / 2]!) / 2)
  const communityCount = new Set(subs.map((r) => (r.SubdivisionName ?? '').trim()).filter((s) => s && s.toLowerCase() !== 'n/a')).size
  const db = cityRow.data as { name?: string; description?: string | null; hero_image_url?: string | null } | null
  const bannerUrl = await getBannerUrl('city', slug)
  return {
    slug,
    name: db?.name ?? cityName,
    description: db?.description ?? null,
    heroImageUrl: normalizeBannerLikeUrl(db?.hero_image_url ?? null) ?? bannerUrl ?? null,
    activeCount,
    medianPrice: medianFromRows ?? stats.medianPrice,
    avgDom: stats.avgDom ?? null,
    closedLast12Months: stats.closedLast12Months,
    communityCount,
  }
}

export const getCityBySlug = unstable_cache(
  _getCityBySlugUncached,
  ['city-by-slug-v1'],
  { revalidate: 300, tags: ['city-detail'] }
)

/** Active listings in a city, newest first, limit 24. */
async function _getCityListingsUncached(
  cityName: string,
  limit: number
): Promise<CityListingRow[]> {
  const { data } = await supabase()
    .from('listings')
    .select(HOME_TILE_SELECT)
    .ilike('City', cityName)
    .or(ACTIVE_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as CityListingRow[]
}

export const getCityListings = unstable_cache(
  _getCityListingsUncached,
  ['city-listings-v1'],
  { revalidate: 120, tags: ['city-listings'] }
)

/** Recently sold in city, limit 6. */
async function _getCitySoldListingsUncached(
  cityName: string,
  limit: number
): Promise<(CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  const { data } = await supabase()
    .from('listings')
    .select(`${HOME_TILE_SELECT}, ClosePrice, CloseDate`)
    .ilike('City', cityName)
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as (CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]
}

export const getCitySoldListings = unstable_cache(
  _getCitySoldListingsUncached,
  ['city-sold-listings-v1'],
  { revalidate: 300, tags: ['city-sold-listings'] }
)

/** Pending/under contract listings in a city, newest first, limit 12. */
async function _getCityPendingListingsUncached(
  cityName: string,
  limit: number
): Promise<CityListingRow[]> {
  const { data } = await supabase()
    .from('listings')
    .select(HOME_TILE_SELECT)
    .ilike('City', cityName)
    .or(PENDING_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as CityListingRow[]
}

export const getCityPendingListings = unstable_cache(
  _getCityPendingListingsUncached,
  ['city-pending-listings-v1'],
  { revalidate: 120, tags: ['city-pending-listings'] }
)

/** Communities (subdivisions) in this city for CityCommunities section. */
async function getCommunitiesInCityUncached(cityName: string): Promise<CommunityForIndex[]> {
  const [hot, flags, listingRows] = await Promise.all([
    getHotCommunitiesInCity(cityName),
    listSubdivisionsWithFlags(),
    supabase()
      .from('listings')
      .select('SubdivisionName, ListPrice, PropertyType')
      .ilike('City', cityName)
      .or(ACTIVE_OR)
      .limit(4000)
      .then((res) => (res.data ?? []) as { SubdivisionName?: string | null; ListPrice?: number | null; PropertyType?: string | null }[]),
  ])
  const bySubdivision = new Map<string, number[]>()
  const countBySubdivision = new Map<string, number>()
  const pendingBySubdivision = new Map<string, number>()
  const hotBySubdivision = new Map(hot.map((entry) => [entry.subdivisionName, entry]))
  for (const row of listingRows) {
    if (!isResidentialInventoryType(row.PropertyType ?? null)) continue
    const sub = (row.SubdivisionName ?? '').trim()
    if (!sub) continue
    countBySubdivision.set(sub, (countBySubdivision.get(sub) ?? 0) + 1)
    const price = Number(row.ListPrice)
    if (Number.isFinite(price) && price > 0) {
      const prices = bySubdivision.get(sub) ?? []
      prices.push(price)
      bySubdivision.set(sub, prices)
    }
  }
  const { data: pendingRows } = await supabase()
    .from('listings')
    .select('SubdivisionName')
    .ilike('City', cityName)
    .or(PENDING_OR)
    .limit(4000)
  for (const row of pendingRows ?? []) {
    const sub = String((row as { SubdivisionName?: string | null }).SubdivisionName ?? '').trim()
    if (!sub) continue
    pendingBySubdivision.set(sub, (pendingBySubdivision.get(sub) ?? 0) + 1)
  }
  const resortSet = new Set(
    (await import('@/app/actions/subdivision-flags').then((m) => m.getResortEntityKeys()))
  )
  const entityKey = (c: string, s: string) => `${slugify(c)}:${slugify(s)}`
  const subdivisionNames = Array.from(new Set([...countBySubdivision.keys(), ...pendingBySubdivision.keys()]))
  const entityKeys = subdivisionNames.map((name) => entityKey(cityName, name))
  const bannerMap = await getBannersBatch('subdivision', entityKeys)
  const result: CommunityForIndex[] = []
  for (const subdivisionName of subdivisionNames) {
    const h = hotBySubdivision.get(subdivisionName)
    const key = entityKey(cityName, subdivisionName)
    const isResort = flags.some((f) => f.entity_key === key && f.is_resort) || resortSet.has(key)
    const heroUrl = bannerMap.get(key)?.url ?? null
    const resortHeroUrl = isResort ? getResortCommunityImage(cityName, subdivisionName) : null
    result.push({
      slug: entityKeyToSlug(key),
      entityKey: key,
      city: cityName,
      subdivision: subdivisionName,
      activeCount: countBySubdivision.get(subdivisionName) ?? h?.forSale ?? 0,
      medianPrice: (() => {
        const prices = bySubdivision.get(subdivisionName) ?? []
        if (prices.length === 0) return h?.medianListPrice ?? null
        prices.sort((a, b) => a - b)
        const mid = Math.floor(prices.length / 2)
        return prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
      })(),
      heroImageUrl: heroUrl ?? resortHeroUrl ?? null,
      isResort,
    })
  }
  result.sort((a, b) => {
    if ((b.isResort ? 1 : 0) !== (a.isResort ? 1 : 0)) return (b.isResort ? 1 : 0) - (a.isResort ? 1 : 0)
    const pendingDelta = (pendingBySubdivision.get(b.subdivision) ?? 0) - (pendingBySubdivision.get(a.subdivision) ?? 0)
    if (pendingDelta !== 0) return pendingDelta
    const activeDelta = b.activeCount - a.activeCount
    if (activeDelta !== 0) return activeDelta
    return a.subdivision.localeCompare(b.subdivision)
  })
  return result
}

export const getCommunitiesInCity = unstable_cache(
  getCommunitiesInCityUncached,
  ['communities-in-city-v2'],
  { revalidate: 300, tags: ['communities-in-city'] }
)

/** Neighborhoods in this city (from neighborhoods table). Uses RPC when available for single-query stats; otherwise N+1 fallback. */
export async function getNeighborhoodsInCity(cityName: string): Promise<
  { slug: string; name: string; listingCount: number; medianPrice: number | null }[]
> {
  const sb = supabase()
  const { data: cityRow } = await sb
    .from('cities')
    .select('id')
    .ilike('name', cityName)
    .maybeSingle()
  const cityId = (cityRow as { id?: string } | null)?.id
  if (!cityId) return []
  try {
    const { data: stats, error } = await sb.rpc('get_neighborhoods_in_city_stats', { p_city_id: cityId })
    if (!error && stats && Array.isArray(stats)) {
      return stats.map((r: { slug?: string; name?: string; listing_count?: number; median_price?: number | null }) => ({
        slug: String(r.slug ?? ''),
        name: String(r.name ?? ''),
        listingCount: Number(r.listing_count ?? 0),
        medianPrice: r.median_price != null ? Number(r.median_price) : null,
      }))
    }
  } catch {
    // Fall through to legacy path
  }
  const { data: neighborhoods } = await sb
    .from('neighborhoods')
    .select('id, name, slug')
    .eq('city_id', cityId)
  const list = (neighborhoods ?? []) as { id: string; name: string; slug: string }[]
  if (list.length === 0) return []
  const out: { slug: string; name: string; listingCount: number; medianPrice: number | null }[] = []
  for (const n of list) {
    const { data: propIds } = await sb.from('properties').select('id').eq('neighborhood_id', n.id).limit(5000)
    const ids = (propIds ?? []).map((p: { id: string }) => p.id)
    let listingCount = 0
    let medianPrice: number | null = null
    if (ids.length > 0) {
      const { count } = await sb
        .from('listings')
        .select('ListPrice', { count: 'exact', head: true })
        .or(ACTIVE_OR)
        .in('property_id', ids)
      listingCount = count ?? 0
      const { data: priceRows } = await sb
        .from('listings')
        .select('ListPrice, PropertyType')
        .in('property_id', ids)
        .or(ACTIVE_OR)
        .limit(1000)
      const filteredRows = (priceRows ?? []).filter((row: { PropertyType?: string | null }) => isResidentialInventoryType(row.PropertyType ?? null))
      listingCount = filteredRows.length
      const prices = filteredRows.map((r: { ListPrice?: number }) => Number(r.ListPrice)).filter((p) => Number.isFinite(p) && p > 0)
      prices.sort((a, b) => a - b)
      if (prices.length > 0) {
        const mid = Math.floor(prices.length / 2)
        medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
      }
    }
    out.push({ slug: n.slug, name: n.name, listingCount, medianPrice })
  }
  return out
}

/** Price history for city (reporting_cache; fallback from closed listings by month when cache has fewer than 2 points). */
export async function getCityPriceHistory(cityName: string): Promise<{ month: string; medianPrice: number; soldCount?: number }[]> {
  const sb = supabase()
  const { data } = await sb
    .from('reporting_cache')
    .select('period_start, metrics')
    .eq('geo_type', 'city')
    .ilike('geo_name', cityName)
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: true })
    .limit(12)
  const rows = (data ?? []) as { period_start?: string; metrics?: { median_price?: number; sold_count?: number } }[]
  const fromCache = rows
    .filter((r) => r.metrics?.median_price != null)
    .map((r) => ({
      month: r.period_start ?? '',
      medianPrice: r.metrics!.median_price!,
      soldCount: Number(r.metrics?.sold_count ?? 0),
    }))
  if (fromCache.length >= 2) return fromCache
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const { data: closed } = await sb
    .from('listings')
    .select('ListPrice, CloseDate')
    .ilike('City', cityName)
    .ilike('StandardStatus', '%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', twelveMonthsAgo.toISOString().slice(0, 7))
    .limit(2000)
  const byMonth = new Map<string, number[]>()
  const byMonthCount = new Map<string, number>()
  for (const r of (closed ?? []) as { ListPrice?: number | null; CloseDate?: string }[]) {
    const p = Number(r.ListPrice)
    const d = r.CloseDate?.slice(0, 7)
    if (!d || !Number.isFinite(p) || p <= 0) continue
    const arr = byMonth.get(d) ?? []
    arr.push(p)
    byMonth.set(d, arr)
    byMonthCount.set(d, (byMonthCount.get(d) ?? 0) + 1)
  }
  const fallback = Array.from(byMonth.entries())
    .map(([month, prices]) => {
      prices.sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
      return { month, medianPrice, soldCount: byMonthCount.get(month) ?? 0 }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
  return fallback.length >= 2 ? fallback : fromCache
}

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
  const sb = supabase()
  const { data: cityRow } = await sb
    .from('cities')
    .select('id')
    .ilike('name', cityName)
    .maybeSingle()
  const cityId = (cityRow as { id?: string } | null)?.id
  if (!cityId) return null
  const { data: neighborhoodRow } = await sb
    .from('neighborhoods')
    .select('id, name, slug, description, hero_image_url, boundary_geojson, seo_title, seo_description')
    .eq('city_id', cityId)
    .ilike('slug', neighborhoodSlug)
    .maybeSingle()
  const n = neighborhoodRow as {
    id: string
    name: string
    slug: string
    description?: string | null
    hero_image_url?: string | null
    boundary_geojson?: unknown
    seo_title?: string | null
    seo_description?: string | null
  } | null
  if (!n) return null
  const { data: propIds } = await sb.from('properties').select('id').eq('neighborhood_id', n.id).limit(5000)
  const ids = (propIds ?? []).map((p: { id: string }) => p.id)
  let activeCount = 0
  let medianPrice: number | null = null
  if (ids.length > 0) {
    const { data: priceRows } = await sb
      .from('listings')
      .select('ListPrice, PropertyType')
      .in('property_id', ids)
      .or(ACTIVE_OR)
      .limit(1000)
    const filteredRows = (priceRows ?? []).filter((row: { PropertyType?: string | null }) => isResidentialInventoryType(row.PropertyType ?? null))
    activeCount = filteredRows.length
    const prices = filteredRows.map((r: { ListPrice?: number }) => Number(r.ListPrice)).filter((p) => Number.isFinite(p) && p > 0)
    prices.sort((a, b) => a - b)
    if (prices.length > 0) {
      const mid = Math.floor(prices.length / 2)
      medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
    }
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
  ['neighborhood-by-slug-v1'],
  { revalidate: 300, tags: ['neighborhood-detail'] }
)

/** Boundary GeoJSON for a city (for map overlay on city/community search). Returns null if not found. */
export async function getCityBoundary(cityName: string): Promise<unknown | null> {
  if (!cityName?.trim()) return null
  const sb = supabase()
  const { data } = await sb
    .from('cities')
    .select('boundary_geojson')
    .ilike('name', cityName.trim())
    .maybeSingle()
  const row = data as { boundary_geojson?: unknown } | null
  return row?.boundary_geojson ?? null
}

/** Active listings in a neighborhood (property_id in properties with neighborhood_id), limit 24. Uses RPC when available for one-query performance. */
async function _getNeighborhoodListingsUncached(
  neighborhoodId: string,
  limit: number
): Promise<CityListingRow[]> {
  const sb = supabase()
  try {
    const { data, error } = await sb.rpc('get_neighborhood_listings', {
      p_neighborhood_id: neighborhoodId,
      p_limit: Math.min(limit, 100),
    })
    if (!error && data && Array.isArray(data) && data.length > 0) {
      return data as CityListingRow[]
    }
  } catch {
    // Fall through to legacy path
  }
  const { data: propIds } = await sb.from('properties').select('id').eq('neighborhood_id', neighborhoodId).limit(5000)
  const ids = (propIds ?? []).map((p: { id: string }) => p.id)
  if (ids.length === 0) return []
  const { data } = await sb
    .from('listings')
    .select(HOME_TILE_SELECT)
    .in('property_id', ids)
    .or(ACTIVE_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as CityListingRow[]
}

export const getNeighborhoodListings = unstable_cache(
  _getNeighborhoodListingsUncached,
  ['neighborhood-listings-v1'],
  { revalidate: 120, tags: ['neighborhood-listings'] }
)

/** Recently sold in neighborhood, limit 6. */
async function _getNeighborhoodSoldListingsUncached(
  neighborhoodId: string,
  limit: number
): Promise<(CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  const sb = supabase()
  const { data: propIds } = await sb.from('properties').select('id').eq('neighborhood_id', neighborhoodId).limit(5000)
  const ids = (propIds ?? []).map((p: { id: string }) => p.id)
  if (ids.length === 0) return []
  const { data } = await sb
    .from('listings')
    .select(`${HOME_TILE_SELECT}, ClosePrice, CloseDate`)
    .in('property_id', ids)
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as (CityListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]
}

export const getNeighborhoodSoldListings = unstable_cache(
  _getNeighborhoodSoldListingsUncached,
  ['neighborhood-sold-listings-v1'],
  { revalidate: 300, tags: ['neighborhood-sold-listings'] }
)

/** Median sold price by month for neighborhood for last 12 months. */
async function _getNeighborhoodPriceHistoryUncached(
  neighborhoodId: string
): Promise<{ month: string; medianPrice: number; soldCount?: number }[]> {
  const sb = supabase()
  const { data: propIds } = await sb.from('properties').select('id').eq('neighborhood_id', neighborhoodId).limit(5000)
  const ids = (propIds ?? []).map((p: { id: string }) => p.id)
  if (ids.length === 0) return []

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
  const minMonth = twelveMonthsAgo.toISOString().slice(0, 7)

  const { data: closedRows } = await sb
    .from('listings')
    .select('ListPrice, CloseDate')
    .in('property_id', ids)
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', minMonth)
    .limit(4000)

  const byMonth = new Map<string, number[]>()
  const byMonthCount = new Map<string, number>()
  for (const row of (closedRows ?? []) as { ListPrice?: number | null; CloseDate?: string | null }[]) {
    const month = String(row.CloseDate ?? '').slice(0, 7)
    const price = Number(row.ListPrice)
    if (!month || !Number.isFinite(price) || price <= 0) continue
    const arr = byMonth.get(month) ?? []
    arr.push(price)
    byMonth.set(month, arr)
    byMonthCount.set(month, (byMonthCount.get(month) ?? 0) + 1)
  }

  return Array.from(byMonth.entries())
    .map(([month, prices]) => {
      prices.sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const medianPrice =
        prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
      return { month, medianPrice, soldCount: byMonthCount.get(month) ?? 0 }
    })
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)
}

export const getNeighborhoodPriceHistory = unstable_cache(
  _getNeighborhoodPriceHistoryUncached,
  ['neighborhood-price-history-v1'],
  { revalidate: 3600, tags: ['neighborhood-price-history'] }
)

/** Pending/under contract listings in a neighborhood, newest first, limit 12. */
async function _getNeighborhoodPendingListingsUncached(
  neighborhoodId: string,
  limit: number
): Promise<CityListingRow[]> {
  const sb = supabase()
  const { data: propIds } = await sb.from('properties').select('id').eq('neighborhood_id', neighborhoodId).limit(5000)
  const ids = (propIds ?? []).map((p: { id: string }) => p.id)
  if (ids.length === 0) return []
  const { data } = await sb
    .from('listings')
    .select(HOME_TILE_SELECT)
    .in('property_id', ids)
    .or(PENDING_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as CityListingRow[]
}

export const getNeighborhoodPendingListings = unstable_cache(
  _getNeighborhoodPendingListingsUncached,
  ['neighborhood-pending-listings-v1'],
  { revalidate: 120, tags: ['neighborhood-pending-listings'] }
)

/** Communities (subdivisions) within a specific neighborhood. */
export async function getCommunitiesInNeighborhood(neighborhoodId: string, cityName: string): Promise<CommunityForIndex[]> {
  const sb = supabase()
  const [flags, communityRows] = await Promise.all([
    listSubdivisionsWithFlags(),
    // Get all communities in this neighborhood
    sb
      .from('communities')
      .select('name, slug, hero_image_url, is_resort')
      .eq('neighborhood_id', neighborhoodId)
      .then((r) => (r.data ?? []) as { name: string; slug: string; hero_image_url?: string | null; is_resort?: boolean }[]),
  ])

  if (communityRows.length === 0) return []

  // Get listing data for the specific subdivisions in this neighborhood
  const communityNames = communityRows.map((c) => c.name)
  const { data: listingRowsData } = await sb
    .from('listings')
    .select('SubdivisionName, ListPrice, PropertyType')
    .in('SubdivisionName', communityNames)
    .eq('StandardStatus', 'Active')
    .limit(2000)
  const listingRows = (listingRowsData ?? []) as { SubdivisionName?: string; ListPrice?: number | null; PropertyType?: string | null }[]

  const bySub = new Map<string, number[]>()
  for (const row of listingRows) {
    if (!isResidentialInventoryType(row.PropertyType ?? null)) continue
    const sub = (row.SubdivisionName ?? '').trim()
    if (!sub || sub.toLowerCase() === 'n/a') continue
    const arr = bySub.get(sub) ?? []
    const p = Number(row.ListPrice)
    if (Number.isFinite(p) && p > 0) arr.push(p)
    bySub.set(sub, arr)
  }

  const resortSet = new Set(
    (await import('@/app/actions/subdivision-flags').then((m) => m.getResortEntityKeys()))
  )
  const entityKey = (c: string, s: string) => `${slugify(c)}:${slugify(s)}`
  const entityKeys = communityRows.map((comm) => entityKey(cityName, comm.name))
  const bannerMap = await getBannersBatch('subdivision', entityKeys)

  const result: CommunityForIndex[] = []
  for (const comm of communityRows) {
    const prices = bySub.get(comm.name) ?? []
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
  return result
}
