'use server'

import { createClient } from '@supabase/supabase-js'
import { subdivisionEntityKey, slugify } from '@/lib/slug'
import { parseCommunitySlug } from '@/lib/community-slug'
import { getBannerUrl } from '@/app/actions/banners'
import { getCityMarketStats } from '@/app/actions/listings'
import type { CityMarketStats } from '@/app/actions/listings'
import { listSubdivisionsWithFlags } from '@/app/actions/subdivision-flags'
import type { CommunityForIndex, CommunityDetail } from '@/lib/communities'
import { entityKeyToSlug } from '@/lib/community-slug'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
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
export async function getCommunitiesForIndex(): Promise<CommunityForIndex[]> {
  const [rows, resortSet, listingRows] = await Promise.all([
    listSubdivisionsWithFlags(),
    import('@/app/actions/subdivision-flags').then((m) => m.getResortEntityKeys()),
    supabase()
      .from('listings')
      .select('City, SubdivisionName, ListPrice, StandardStatus')
      .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
      .limit(8000)
      .then((r) => (r.data ?? []) as { City?: string; SubdivisionName?: string; ListPrice?: number | null; StandardStatus?: string | null }[]),
  ])
  const byKey = new Map<
    string,
    { city: string; subdivision: string; prices: number[] }
  >()
  for (const row of listingRows) {
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
  for (const r of rows) {
    const entityKey = r.entity_key
    if (seen.has(entityKey)) continue
    seen.add(entityKey)
    const agg = byKey.get(entityKey)
    const activeCount = agg ? agg.prices.length : 0
    let medianPrice: number | null = null
    if (agg && agg.prices.length > 0) {
      agg.prices.sort((a, b) => a - b)
      const mid = Math.floor(agg.prices.length / 2)
      medianPrice = agg.prices.length % 2 ? agg.prices[mid]! : Math.round((agg.prices[mid - 1]! + agg.prices[mid]!) / 2)
    }
    const heroResult = await getBannerUrl('subdivision', entityKey)
    result.push({
      slug: entityKeyToSlug(entityKey),
      entityKey,
      city: r.city,
      subdivision: r.subdivision,
      activeCount,
      medianPrice,
      heroImageUrl: heroResult ?? null,
      isResort: r.is_resort || resortSet.has(entityKey),
      description: undefined,
    })
  }
  result.sort((a, b) => a.subdivision.localeCompare(b.subdivision))
  return result
}

/** Get community by slug; returns null if not found. */
export async function getCommunityBySlug(slug: string): Promise<CommunityDetail | null> {
  const citySlugs = await getCitySlugs()
  const parsed = parseCommunitySlug(slug, citySlugs)
  if (!parsed) return null
  const { city, subdivision } = parsed
  const entityKey = subdivisionEntityKey(city, subdivision)
  const sb = supabase()
  const [stats, countRes, communityRow] = await Promise.all([
    getCityMarketStats({ city, subdivision }),
    sb
      .from('listings')
      .select('ListPrice', { count: 'exact', head: true })
      .ilike('City', city)
      .ilike('SubdivisionName', subdivision)
      .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'),
    sb.from('communities').select('id, name, slug, description, hero_image_url, boundary_geojson, is_resort, resort_content').ilike('name', subdivision).maybeSingle(),
  ])
  const activeCount = countRes.count ?? 0
  const comm = communityRow.data as {
    name?: string
    description?: string | null
    hero_image_url?: string | null
    boundary_geojson?: unknown
    is_resort?: boolean
    resort_content?: Record<string, unknown> | null
  } | null
  const bannerUrl = await getBannerUrl('subdivision', entityKey)
  const flags = await listSubdivisionsWithFlags()
  const isResort = flags.some((f) => f.entity_key === entityKey && f.is_resort) || comm?.is_resort === true
  return {
    slug,
    entityKey,
    city,
    subdivision,
    name: comm?.name ?? subdivision,
    description: comm?.description ?? null,
    heroImageUrl: comm?.hero_image_url ?? bannerUrl ?? null,
    boundaryGeojson: comm?.boundary_geojson ?? null,
    isResort,
    resortContent: comm?.resort_content ?? null,
    activeCount,
    medianPrice: stats.medianPrice,
    avgDom: null,
    closedLast12Months: stats.closedLast12Months,
  }
}

const HOME_TILE_SELECT =
  'ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, Latitude, Longitude, ModificationTimestamp, PropertyType, StandardStatus, TotalLivingAreaSqFt, ListOfficeName, ListAgentName, OnMarketDate, OpenHouses, details'

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
  details?: unknown
}

/** Active listings in a community (city + subdivision), newest first, limit 24. */
export async function getCommunityListings(
  city: string,
  subdivision: string,
  limit: number
): Promise<ListingRow[]> {
  const sb = supabase()
  const { data } = await sb
    .from('listings')
    .select(HOME_TILE_SELECT)
    .ilike('City', city)
    .ilike('SubdivisionName', subdivision)
    .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%')
    .order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as ListingRow[]
}

/** Recently sold in community (last 12 months), limit 6. */
export async function getCommunitySoldListings(
  city: string,
  subdivision: string,
  limit: number
): Promise<(ListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  const sb = supabase()
  const { data } = await sb
    .from('listings')
    .select(`${HOME_TILE_SELECT}, ClosePrice, CloseDate`)
    .ilike('City', city)
    .ilike('SubdivisionName', subdivision)
    .or('StandardStatus.ilike.%Closed%')
    .not('CloseDate', 'is', null)
    .order('CloseDate', { ascending: false, nullsFirst: false })
    .limit(limit)
  return (data ?? []) as (ListingRow & { ClosePrice?: number | null; CloseDate?: string | null })[]
}

/** Median price per month for last 12 months (from listings or reporting_cache). */
export async function getCommunityPriceHistory(
  city: string,
  subdivision: string
): Promise<{ month: string; medianPrice: number }[]> {
  const sb = supabase()
  const { data } = await sb
    .from('reporting_cache')
    .select('period_start, metrics')
    .eq('geo_type', 'subdivision')
    .eq('geo_name', subdivision)
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

/** Market stats for community (reuse getCityMarketStats with subdivision). */
export async function getCommunityMarketStats(
  city: string,
  subdivision: string
): Promise<CityMarketStats> {
  return getCityMarketStats({ city, subdivision })
}
