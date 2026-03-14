'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { slugify, cityEntityKey } from '@/lib/slug'
import type { CityForIndex, CityDetail } from '@/lib/cities'
import { getBannerUrl, getBannersBatch } from '@/app/actions/banners'
import {
  getBrowseCities,
  getCityMarketStats,
  getCityFromSlug,
} from '@/app/actions/listings'
import type { CityMarketStats } from '@/app/actions/listings'
import { getHotCommunitiesInCity } from '@/app/actions/listings'
import { entityKeyToSlug } from '@/lib/community-slug'
import type { CommunityForIndex } from '@/lib/communities'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

const ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'
const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, details'

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
  details?: unknown
}

/** All cities for index with counts and median — uses RPC for single-scan aggregation instead of 60k row fetches. */
async function _getCitiesForIndexUncached(): Promise<CityForIndex[]> {
  const sb = supabase()

  // Try fast RPC path first (single table scan with GROUP BY)
  let cityStats: { city_name: string; active_count: number; median_price: number | null; community_count: number }[] = []
  try {
    const { data, error } = await sb.rpc('get_browse_cities_stats')
    if (!error && data) cityStats = data as typeof cityStats
  } catch {
    // RPC not deployed yet — fall through to legacy path
  }

  if (cityStats.length > 0) {
    // Fast path: RPC returned data, just need banners + city metadata
    const allCityNames = cityStats.map((r) => r.city_name)
    const allSlugs = allCityNames.map((name) => slugify(name))

    const [bannerMap, cityMetaRes] = await Promise.all([
      getBannersBatch('city', allSlugs),
      sb.from('cities').select('name, description, hero_image_url').in('name', allCityNames),
    ])

    const cityMetaByName = new Map<string, { description?: string | null; hero_image_url?: string | null }>()
    for (const row of (cityMetaRes.data ?? []) as { name: string; description?: string | null; hero_image_url?: string | null }[]) {
      cityMetaByName.set(row.name.toLowerCase(), row)
    }

    return cityStats.map((row) => {
      const slug = slugify(row.city_name)
      const banner = bannerMap.get(slug)
      const db = cityMetaByName.get(row.city_name.toLowerCase()) ?? null
      return {
        slug,
        name: row.city_name,
        activeCount: row.active_count,
        medianPrice: row.median_price ? Math.round(row.median_price) : null,
        communityCount: row.community_count,
        heroImageUrl: db?.hero_image_url ?? banner?.url ?? null,
        description: db?.description ?? null,
      }
    })
  }

  // Legacy fallback: fetch from listings table directly
  const [browse, listingRows] = await Promise.all([
    getBrowseCities(),
    sb
      .from('listings')
      .select('City, SubdivisionName, ListPrice, StandardStatus')
      .or(ACTIVE_OR)
      .limit(10000)
      .then((r) =>
        (r.data ?? []) as {
          City?: string
          SubdivisionName?: string
          ListPrice?: number | null
          StandardStatus?: string | null
        }[]
      ),
  ])
  const byCity = new Map<string, { prices: number[]; subdivisions: Set<string> }>()
  for (const row of listingRows) {
    const city = (row.City ?? '').toString().trim()
    if (!city) continue
    const rec = byCity.get(city) ?? { prices: [], subdivisions: new Set<string>() }
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
    const activeCount = rec ? rec.prices.length : count
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
    result.push({ slug, name, activeCount, medianPrice, communityCount, heroImageUrl: db?.hero_image_url ?? banner?.url ?? null, description: db?.description ?? null })
  }
  result.sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))
  return result
}

export const getCitiesForIndex = unstable_cache(
  _getCitiesForIndexUncached,
  ['cities-index'],
  { revalidate: 300, tags: ['cities-index'] }
)

/** Get city by slug; returns null if not found. */
export async function getCityBySlug(slug: string): Promise<CityDetail | null> {
  const cityName = await getCityFromSlug(slug)
  if (!cityName) return null
  const [stats, countRes, cityRow, subRows] = await Promise.all([
    getCityMarketStats({ city: cityName }),
    supabase()
      .from('listings')
      .select('ListPrice', { count: 'exact', head: true })
      .ilike('City', cityName)
      .or(ACTIVE_OR),
    supabase()
      .from('cities')
      .select('name, slug, description, hero_image_url')
      .ilike('name', cityName)
      .maybeSingle(),
    supabase()
      .from('listings')
      .select('SubdivisionName')
      .ilike('City', cityName)
      .or(ACTIVE_OR)
      .limit(5000),
  ])
  const activeCount = countRes.count ?? 0
  const subs = (subRows.data ?? []) as { SubdivisionName?: string }[]
  const communityCount = new Set(subs.map((r) => (r.SubdivisionName ?? '').trim()).filter((s) => s && s.toLowerCase() !== 'n/a')).size
  const db = cityRow.data as { name?: string; description?: string | null; hero_image_url?: string | null } | null
  const bannerUrl = await getBannerUrl('city', slug)
  return {
    slug,
    name: db?.name ?? cityName,
    description: db?.description ?? null,
    heroImageUrl: db?.hero_image_url ?? bannerUrl ?? null,
    activeCount,
    medianPrice: stats.medianPrice,
    avgDom: null,
    closedLast12Months: stats.closedLast12Months,
    communityCount,
  }
}

/** Active listings in a city, newest first, limit 24. */
export async function getCityListings(
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

/** Recently sold in city, limit 6. */
export async function getCitySoldListings(
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

/** Communities (subdivisions) in this city for CityCommunities section. */
export async function getCommunitiesInCity(cityName: string): Promise<CommunityForIndex[]> {
  const [hot, flags, listingRows] = await Promise.all([
    getHotCommunitiesInCity(cityName),
    listSubdivisionsWithFlags(),
    supabase()
      .from('listings')
      .select('SubdivisionName, ListPrice, StandardStatus')
      .ilike('City', cityName)
      .or(ACTIVE_OR)
      .limit(5000)
      .then((r) => (r.data ?? []) as { SubdivisionName?: string; ListPrice?: number | null }[]),
  ])
  const bySub = new Map<string, number[]>()
  for (const row of listingRows) {
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
  const result: CommunityForIndex[] = []
  for (const h of hot) {
    const prices = bySub.get(h.subdivisionName) ?? []
    prices.sort((a, b) => a - b)
    const medianPrice =
      prices.length === 0
        ? null
        : prices.length % 2
          ? prices[Math.floor(prices.length / 2)]!
          : Math.round((prices[prices.length / 2 - 1]! + prices[prices.length / 2]!) / 2)
    const key = entityKey(cityName, h.subdivisionName)
    const isResort = flags.some((f) => f.entity_key === key && f.is_resort) || resortSet.has(key)
    const heroUrl = await getBannerUrl('subdivision', key)
    result.push({
      slug: entityKeyToSlug(key),
      entityKey: key,
      city: cityName,
      subdivision: h.subdivisionName,
      activeCount: h.forSale + h.pending,
      medianPrice: h.medianListPrice ?? medianPrice,
      heroImageUrl: heroUrl ?? null,
      isResort,
    })
  }
  return result
}

/** Neighborhoods in this city (from neighborhoods table). Listing count via properties.neighborhood_id when available. */
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
        .select('ListPrice')
        .in('property_id', ids)
        .or(ACTIVE_OR)
        .not('ListPrice', 'is', null)
        .limit(500)
      const prices = (priceRows ?? []).map((r: { ListPrice?: number }) => Number(r.ListPrice)).filter((p) => Number.isFinite(p) && p > 0)
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
export async function getCityPriceHistory(cityName: string): Promise<{ month: string; medianPrice: number }[]> {
  const sb = supabase()
  const { data } = await sb
    .from('reporting_cache')
    .select('period_start, metrics')
    .eq('geo_type', 'city')
    .ilike('geo_name', cityName)
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: true })
    .limit(12)
  const rows = (data ?? []) as { period_start?: string; metrics?: { median_price?: number } }[]
  const fromCache = rows
    .filter((r) => r.metrics?.median_price != null)
    .map((r) => ({ month: r.period_start ?? '', medianPrice: r.metrics!.median_price! }))
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
  for (const r of (closed ?? []) as { ListPrice?: number | null; CloseDate?: string }[]) {
    const p = Number(r.ListPrice)
    const d = r.CloseDate?.slice(0, 7)
    if (!d || !Number.isFinite(p) || p <= 0) continue
    const arr = byMonth.get(d) ?? []
    arr.push(p)
    byMonth.set(d, arr)
  }
  const fallback = Array.from(byMonth.entries())
    .map(([month, prices]) => {
      prices.sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      const medianPrice = prices.length % 2 ? prices[mid]! : Math.round((prices[mid - 1]! + prices[mid]!) / 2)
      return { month, medianPrice }
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

export async function getNeighborhoodBySlug(
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
    const { count } = await sb
      .from('listings')
      .select('ListPrice', { count: 'exact', head: true })
      .or(ACTIVE_OR)
      .in('property_id', ids)
    activeCount = count ?? 0
    const { data: priceRows } = await sb
      .from('listings')
      .select('ListPrice')
      .in('property_id', ids)
      .or(ACTIVE_OR)
      .not('ListPrice', 'is', null)
      .limit(500)
    const prices = (priceRows ?? []).map((r: { ListPrice?: number }) => Number(r.ListPrice)).filter((p) => Number.isFinite(p) && p > 0)
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

/** Active listings in a neighborhood (property_id in properties with neighborhood_id), limit 24. */
export async function getNeighborhoodListings(
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
    .or(ACTIVE_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as CityListingRow[]
}

/** Recently sold in neighborhood, limit 6. */
export async function getNeighborhoodSoldListings(
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
  const { data: listingData } = await sb
    .from('listings')
    .select('SubdivisionName, ListPrice, StandardStatus')
    .in('SubdivisionName', communityNames)
    .or(ACTIVE_OR)
    .limit(5000)
  const listingRows = (listingData ?? []) as { SubdivisionName?: string; ListPrice?: number | null }[]

  const bySub = new Map<string, number[]>()
  for (const row of listingRows) {
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
    const heroUrl = comm.hero_image_url ?? (await getBannerUrl('subdivision', key))

    result.push({
      slug: comm.slug,
      entityKey: key,
      city: cityName,
      subdivision: comm.name,
      activeCount: prices.length,
      medianPrice,
      heroImageUrl: heroUrl ?? null,
      isResort,
    })
  }
  return result
}
