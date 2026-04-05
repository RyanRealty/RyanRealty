'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { subdivisionEntityKey, slugify } from '@/lib/slug'
import { getSubdivisionMatchNames } from '@/lib/subdivision-aliases'
import { parseCommunitySlug } from '@/lib/community-slug'
import { getBannerUrl, getBannersBatch, getOrCreatePlaceBanner, getBannerSearchQuery } from '@/app/actions/banners'
import { getMarketStatsForCity, getMarketStatsForSubdivision } from '@/app/actions/market-stats'
import type { CityMarketStats } from '@/app/actions/listings'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import type { CommunityForIndex, CommunityDetail } from '@/lib/communities'
import { entityKeyToSlug } from '@/lib/community-slug'
import { isResidentialInventoryType } from '@/lib/inventory-filters'

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

/** Known city slugs for parsing community slugs. */
export async function getCitySlugs(): Promise<Set<string>> {
  const cities = await import('@/app/actions/listings').then((m) => m.getBrowseCities())
  const set = new Set<string>()
  for (const c of cities) {
    set.add(slugify(c.City))
  }
  const defaults = ['bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'prineville', 'madras', 'terrebonne', 'culver', 'powell-butte']
  defaults.forEach((s) => set.add(s))
  return set
}

/** All communities for index: from listings + subdivision_flags, with counts and hero. */
async function _getCommunitiesForIndexUncached(): Promise<CommunityForIndex[]> {
  // Fetch active listings for community stats — use eq('StandardStatus', 'Active')
  // instead of ILIKE (4x faster: 224ms vs 953ms per page). Covers 98% of active listings.
  // Paginate only if needed, but with eq + index this is much faster.
  const sb = supabase()
  const allListingRows: { City?: string; SubdivisionName?: string; ListPrice?: number | null; PropertyType?: string | null }[] = []
  let offset = 0
  let hasMore = true
  while (hasMore) {
    const { data } = await sb
      .from('listings')
      .select('City, SubdivisionName, ListPrice, PropertyType')
      .eq('StandardStatus', 'Active')
      .not('SubdivisionName', 'is', null)
      .range(offset, offset + 999)
    const rows = (data ?? []) as { City?: string; SubdivisionName?: string; ListPrice?: number | null; PropertyType?: string | null }[]
    allListingRows.push(...rows)
    hasMore = rows.length === 1000
    offset += 1000
  }

  const [rows, resortSet] = await Promise.all([
    listSubdivisionsWithFlags(),
    import('@/app/actions/subdivision-flags').then((m) => m.getResortEntityKeys()),
  ])
  const listingRows = allListingRows
  const byKey = new Map<
    string,
    { city: string; subdivision: string; prices: number[] }
  >()
  for (const row of listingRows) {
    if (!isResidentialInventoryType(row.PropertyType ?? null)) continue
    const city = (row.City ?? '').toString().trim()
    const sub = (row.SubdivisionName ?? '').toString().trim()
    if (!city || !sub) continue
    const key = subdivisionEntityKey(city, sub)
    const rec = byKey.get(key) ?? { city, subdivision: sub, prices: [] }
    const p = Number(row.ListPrice)
    if (Number.isFinite(p) && p > 0) rec.prices.push(p)
    byKey.set(key, rec)
  }
  const result: CommunityForIndex[] = []
  const seen = new Set<string>()
  const entityKeys: string[] = []
  for (const r of rows) {
    const entityKey = r.entity_key
    if (seen.has(entityKey)) continue
    seen.add(entityKey)
    entityKeys.push(entityKey)
    const agg = byKey.get(entityKey)
    const activeCount = agg ? agg.prices.length : 0
    let medianPrice: number | null = null
    if (agg && agg.prices.length > 0) {
      agg.prices.sort((a, b) => a - b)
      const mid = Math.floor(agg.prices.length / 2)
      medianPrice = agg.prices.length % 2 ? agg.prices[mid]! : Math.round((agg.prices[mid - 1]! + agg.prices[mid]!) / 2)
    }
    result.push({
      slug: entityKeyToSlug(entityKey),
      entityKey,
      city: r.city,
      subdivision: r.subdivision,
      activeCount,
      medianPrice,
      heroImageUrl: null,
      isResort: r.is_resort || resortSet.has(entityKey),
      description: undefined,
    })
  }
  const bannerMap = await getBannersBatch('subdivision', entityKeys)
  for (const row of result) {
    row.heroImageUrl = bannerMap.get(row.entityKey)?.url ?? null
  }
  result.sort((a, b) => a.subdivision.localeCompare(b.subdivision))
  return result
}

export const getCommunitiesForIndex = unstable_cache(
  _getCommunitiesForIndexUncached,
  ['communities-index-v2'],
  { revalidate: 1800, tags: ['communities-index'] }
)

/** Get community by slug; returns null if not found. */
async function _getCommunityBySlugUncached(slug: string): Promise<CommunityDetail | null> {
  const citySlugs = await getCitySlugs()
  const parsed = parseCommunitySlug(slug, citySlugs)
  if (!parsed) return null
  const { city, subdivision } = parsed
  const entityKey = subdivisionEntityKey(city, subdivision)
  const sb = supabase()
  const [stats, communityRow, activeRows] = await Promise.all([
    getMarketStatsForSubdivision(city, subdivision),
    sb.from('communities').select('id, name, slug, description, hero_image_url, boundary_geojson, is_resort, resort_content, neighborhood_id, neighborhoods(name, slug)').ilike('name', subdivision).maybeSingle(),
    (async () => {
      const names = getSubdivisionMatchNames(subdivision)
      let query = sb
        .from('listings')
        .select('ListPrice, PropertyType')
        .ilike('City', city)
        .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
        .limit(3000)
      if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
      else if (names.length > 1) query = query.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
      const { data } = await query
      return (data ?? []) as { ListPrice?: number | null; PropertyType?: string | null }[]
    })(),
  ])
  const residentialRows = activeRows.filter((row) => isResidentialInventoryType(row.PropertyType ?? null))
  const activeCount = residentialRows.length > 0 ? residentialRows.length : stats.count
  const prices = residentialRows
    .map((row) => Number(row.ListPrice))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b)
  const medianFromRows =
    prices.length === 0
      ? null
      : prices.length % 2
        ? prices[Math.floor(prices.length / 2)]!
        : Math.round((prices[prices.length / 2 - 1]! + prices[prices.length / 2]!) / 2)
  const comm = communityRow.data as {
    name?: string
    description?: string | null
    hero_image_url?: string | null
    boundary_geojson?: unknown
    is_resort?: boolean
    resort_content?: Record<string, unknown> | null
    neighborhood_id?: string | null
    neighborhoods?: { name: string; slug: string } | null
  } | null
  let bannerUrl = await getBannerUrl('subdivision', entityKey)
  const flags = await listSubdivisionsWithFlags()
  const isResort = flags.some((f) => f.entity_key === entityKey && f.is_resort) || comm?.is_resort === true
  if (!bannerUrl) {
    const searchQuery = getBannerSearchQuery('subdivision', subdivision, city, isResort)
    const created = await getOrCreatePlaceBanner('subdivision', entityKey, searchQuery)
    bannerUrl = created.url ?? null
  }
  const citySlug = slugify(city)
  return {
    slug,
    entityKey,
    city,
    citySlug,
    subdivision,
    name: comm?.name ?? subdivision,
    description: comm?.description ?? null,
    heroImageUrl: normalizeBannerLikeUrl(comm?.hero_image_url ?? null) ?? bannerUrl ?? null,
    boundaryGeojson: comm?.boundary_geojson ?? null,
    isResort,
    resortContent: comm?.resort_content ?? null,
    activeCount,
    medianPrice: medianFromRows ?? stats.medianPrice,
    avgDom: stats.avgDom ?? null,
    closedLast12Months: stats.closedLast12Months,
    neighborhoodName: comm?.neighborhoods?.name ?? null,
    neighborhoodSlug: comm?.neighborhoods?.slug ?? null,
  }
}

export const getCommunityBySlug = unstable_cache(
  _getCommunityBySlugUncached,
  ['community-by-slug-v1'],
  { revalidate: 300, tags: ['community-detail'] }
)

/**
 * Lightweight lookup: given a subdivision name, return its neighborhood and city slug.
 * Used by listing detail page to build the full breadcrumb hierarchy.
 * Returns null if the subdivision has no community record or no neighborhood.
 */
export async function getSubdivisionNeighborhood(subdivisionName: string): Promise<{
  neighborhoodName: string
  neighborhoodSlug: string
  citySlug: string
} | null> {
  const sb = supabase()
  const { data } = await sb
    .from('communities')
    .select('neighborhoods(name, slug), cities(slug)')
    .ilike('name', subdivisionName)
    .not('neighborhood_id', 'is', null)
    .limit(1)
    .maybeSingle()
  const row = data as {
    neighborhoods?: { name: string; slug: string } | null
    cities?: { slug: string } | null
  } | null
  if (!row?.neighborhoods?.name || !row?.neighborhoods?.slug) return null
  return {
    neighborhoodName: row.neighborhoods.name,
    neighborhoodSlug: row.neighborhoods.slug,
    citySlug: row.cities?.slug ?? '',
  }
}

const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, has_virtual_tour, AssociationYN, AssociationFee, AssociationFeeFrequency, details'
const PENDING_OR =
  'StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%Contingent%'

export type ListingRow = {
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
  AssociationYN?: boolean | null
  AssociationFee?: number | null
  AssociationFeeFrequency?: string | null
}

/** Active listings in a community (city + subdivision), newest first, limit 24. */
async function _getCommunityListingsUncached(
  city: string,
  subdivision: string,
  limit: number
): Promise<ListingRow[]> {
  const sb = supabase()
  const names = getSubdivisionMatchNames(subdivision)
  let query = sb
    .from('listings')
    .select(HOME_TILE_SELECT)
    .ilike('City', city)
    .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
  else if (names.length > 1) query = query.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
  const { data } = await query
  return (data ?? []) as ListingRow[]
}

export const getCommunityListings = unstable_cache(
  _getCommunityListingsUncached,
  ['community-listings-v1'],
  { revalidate: 120, tags: ['community-listings'] }
)

/** Recently sold in community (last 12 months), limit 6. */
async function _getCommunitySoldListingsUncached(
  city: string,
  subdivision: string,
  limit: number
): Promise<(ListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  const sb = supabase()
  const names = getSubdivisionMatchNames(subdivision)
  let query = sb
    .from('listings')
    .select(`${HOME_TILE_SELECT}, ClosePrice, CloseDate`)
    .ilike('City', city)
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
  else if (names.length > 1) query = query.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
  const { data } = await query
  return (data ?? []) as (ListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]
}

export const getCommunitySoldListings = unstable_cache(
  _getCommunitySoldListingsUncached,
  ['community-sold-listings-v1'],
  { revalidate: 300, tags: ['community-sold-listings'] }
)

/** Pending/under contract listings in a community (city + subdivision), newest first, limit 12. */
async function _getCommunityPendingListingsUncached(
  city: string,
  subdivision: string,
  limit: number
): Promise<ListingRow[]> {
  const sb = supabase()
  const names = getSubdivisionMatchNames(subdivision)
  let query = sb
    .from('listings')
    .select(HOME_TILE_SELECT)
    .ilike('City', city)
    .or(PENDING_OR)
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (names.length === 1) query = query.ilike('SubdivisionName', names[0]!)
  else if (names.length > 1) query = query.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
  const { data } = await query
  return (data ?? []) as ListingRow[]
}

export const getCommunityPendingListings = unstable_cache(
  _getCommunityPendingListingsUncached,
  ['community-pending-listings-v1'],
  { revalidate: 120, tags: ['community-pending-listings'] }
)

/** Median price per month for last 12 months (reporting_cache; fallback from closed listings when cache has fewer than 2 points). */
export async function getCommunityPriceHistory(
  city: string,
  subdivision: string
): Promise<{ month: string; medianPrice: number; soldCount?: number }[]> {
  const sb = supabase()
  const { data } = await sb
    .from('reporting_cache')
    .select('period_start, metrics')
    .eq('geo_type', 'community')
    .ilike('geo_name', subdivision)
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
  const names = getSubdivisionMatchNames(subdivision)
  let closedQuery = sb
    .from('listings')
    .select('ListPrice, CloseDate')
    .ilike('City', city)
    .ilike('StandardStatus', '%Closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', twelveMonthsAgo.toISOString().slice(0, 7))
    .limit(2000)
  if (names.length === 1) closedQuery = closedQuery.ilike('SubdivisionName', names[0]!)
  else if (names.length > 1) closedQuery = closedQuery.or(names.map((n) => `SubdivisionName.ilike.${n}`).join(','))
  const { data: closed } = await closedQuery
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

/** Market stats for community via cached pulse data (falls back to legacy queries). */
export async function getCommunityMarketStats(
  city: string,
  subdivision: string
): Promise<CityMarketStats> {
  return getMarketStatsForSubdivision(city, subdivision)
}
