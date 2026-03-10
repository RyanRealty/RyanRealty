'use server'

import { createClient } from '@supabase/supabase-js'
import { slugify, cityEntityKey } from '@/lib/slug'
import type { CityForIndex, CityDetail } from '@/lib/cities'
import { getBannerUrl } from '@/app/actions/banners'
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

/** All cities for index with counts and median. */
export async function getCitiesForIndex(): Promise<CityForIndex[]> {
  const [browse, listingRows] = await Promise.all([
    getBrowseCities(),
    supabase()
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
  const byCity = new Map<
    string,
    { prices: number[]; subdivisions: Set<string> }
  >()
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
  const result: CityForIndex[] = []
  for (const { City: name, count } of browse) {
    const rec = byCity.get(name)
    const activeCount = rec ? rec.prices.length : count
    let medianPrice: number | null = null
    if (rec && rec.prices.length > 0) {
      rec.prices.sort((a, b) => a - b)
      const mid = Math.floor(rec.prices.length / 2)
      medianPrice =
        rec.prices.length % 2
          ? rec.prices[mid]!
          : Math.round((rec.prices[mid - 1]! + rec.prices[mid]!) / 2)
    }
    const communityCount = rec?.subdivisions.size ?? 0
    const slug = slugify(name)
    const heroUrl = await getBannerUrl('city', slug)
    const cityRow = await supabase()
      .from('cities')
      .select('description, hero_image_url')
      .ilike('name', name)
      .maybeSingle()
    const db = cityRow.data as { description?: string | null; hero_image_url?: string | null } | null
    result.push({
      slug,
      name,
      activeCount,
      medianPrice,
      communityCount,
      heroImageUrl: db?.hero_image_url ?? heroUrl ?? null,
      description: db?.description ?? null,
    })
  }
  result.sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))
  return result
}

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

/** Price history for city (reporting_cache or empty). */
export async function getCityPriceHistory(cityName: string): Promise<{ month: string; medianPrice: number }[]> {
  const { data } = await supabase()
    .from('reporting_cache')
    .select('period_start, metrics')
    .eq('geo_type', 'city')
    .eq('geo_name', cityName)
    .eq('period_type', 'month')
    .order('period_start', { ascending: true })
    .limit(12)
  const rows = (data ?? []) as { period_start?: string; metrics?: { median_price?: number } }[]
  return rows
    .filter((r) => r.metrics?.median_price != null)
    .map((r) => ({
      month: r.period_start ?? '',
      medianPrice: r.metrics!.median_price!,
    }))
}

/** Neighborhood detail for detail page: resolve by city slug + neighborhood slug. */
export type NeighborhoodDetail = {
  id: string
  name: string
  slug: string
  description: string | null
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
    .select('id, name, slug, description, hero_image_url, boundary_geojson')
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
    heroImageUrl: n.hero_image_url ?? null,
    boundaryGeojson: n.boundary_geojson ?? null,
    cityId,
    cityName,
    citySlug,
    activeCount,
    medianPrice,
  }
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
