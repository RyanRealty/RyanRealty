'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import type { ActivityFeedItem } from './activity-feed-shared'
import { slugify } from '@/lib/slug'

/**
 * Fetch activity feed: events joined to listing data, ordered by event_at desc.
 * Filter by city (single) or cities (array). Use for homepage and feed section.
 */
export async function getActivityFeed(options?: {
  city?: string | null
  /** Multiple cities: include listings in any of these (overrides city when set). */
  cities?: string[] | null
  /** When set, only include listings in this subdivision (matches SubdivisionName). */
  subdivision?: string | null
  /** Restrict to specific event types when provided. */
  eventTypes?: ActivityFeedItem['event_type'][] | null
  limit?: number
  offset?: number
}): Promise<ActivityFeedItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const limit = Math.min(50, Math.max(1, options?.limit ?? 12))
  const offset = Math.max(0, options?.offset ?? 0)
  const supabase = createClient(url, anonKey)

  let eventsQuery = supabase
    .from('activity_events')
    .select('id, listing_key, event_type, event_at, payload')
    .order('event_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const eventTypes = (options?.eventTypes ?? []).filter(Boolean)
  if (eventTypes.length > 0) {
    eventsQuery = eventsQuery.in('event_type', eventTypes)
  }

  const { data: events } = await eventsQuery

  if (!events?.length) return []

  const keys = [...new Set((events as { listing_key: string }[]).map((e) => e.listing_key).filter(Boolean))]
  const [byNum, byKeyRes] = await Promise.all([
    supabase.from('listings').select('ListingKey, ListNumber, mls_source, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, OnMarketDate, CloseDate').in('ListNumber', keys),
    supabase.from('listings').select('ListingKey, ListNumber, mls_source, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, OnMarketDate, CloseDate').in('ListingKey', keys),
  ])
  const listingRows = [...(byNum.data ?? []), ...(byKeyRes.data ?? [])]
  const seen = new Set<string>()
  const deduped = listingRows.filter((r) => {
    const k = (r as { ListNumber?: string }).ListNumber ?? (r as { ListingKey?: string }).ListingKey ?? ''
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const byKey = new Map<string, Record<string, unknown>>()
  for (const r of deduped) {
    const row = r as Record<string, unknown>
    const num = (row.ListNumber ?? '').toString()
    const key = (row.ListingKey ?? row.ListNumber ?? '').toString()
    if (num) byKey.set(num, row)
    if (key) byKey.set(key, row)
  }
  const subdivisionNames = [...new Set(
    deduped
      .map((r) => ((r as { SubdivisionName?: string | null }).SubdivisionName ?? '').toString().trim())
      .filter(Boolean)
  )]
  const neighborhoodByCitySubdivision = new Map<string, { name: string; slug: string }>()
  if (subdivisionNames.length > 0) {
    const { data: communityRows } = await supabase
      .from('communities')
      .select('name, cities(name), neighborhoods(name, slug)')
      .in('name', subdivisionNames)
      .not('neighborhood_id', 'is', null)
      .limit(5000)
    for (const row of (communityRows ?? []) as Array<{
      name?: string | null
      cities?: { name?: string | null } | { name?: string | null }[] | null
      neighborhoods?: { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null
    }>) {
      const subdivisionName = (row.name ?? '').toString().trim()
      if (!subdivisionName) continue
      const cityObj = Array.isArray(row.cities) ? row.cities[0] : row.cities
      const neighborhoodObj = Array.isArray(row.neighborhoods) ? row.neighborhoods[0] : row.neighborhoods
      const cityName = (cityObj?.name ?? '').toString().trim()
      const neighborhoodName = (neighborhoodObj?.name ?? '').toString().trim()
      const neighborhoodSlug = (neighborhoodObj?.slug ?? '').toString().trim()
      if (!cityName || !neighborhoodName || !neighborhoodSlug) continue
      const key = `${slugify(cityName)}::${slugify(subdivisionName)}`
      if (!neighborhoodByCitySubdivision.has(key)) {
        neighborhoodByCitySubdivision.set(key, { name: neighborhoodName, slug: neighborhoodSlug })
      }
    }
  }
  const citySet = options?.cities?.length
    ? new Set(options.cities.map((c) => c.trim()).filter(Boolean))
    : null
  const singleCity = options?.city?.trim() || null
  const result: ActivityFeedItem[] = []
  const subdivisionFilter = options?.subdivision?.trim().toLowerCase()
  for (const e of events as { id: string; listing_key: string; event_type: string; event_at: string; payload?: unknown }[]) {
    const listing = byKey.get(e.listing_key)
    const listingCity = (listing?.City ?? '').toString().trim()
    const listingSubdivision = (listing?.SubdivisionName ?? '').toString().trim()
    if (citySet && !citySet.has(listingCity)) continue
    if (singleCity && !citySet && listingCity !== singleCity) continue
    if (subdivisionFilter) {
      const sub = listingSubdivision.toLowerCase()
      if (!sub || (!sub.includes(subdivisionFilter) && sub !== subdivisionFilter)) continue
    }
    const canonicalKey = (
      listing?.ListingKey ??
      listing?.ListNumber ??
      e.listing_key
    ).toString().trim()
    if (!canonicalKey) continue
    const neighborhoodContext = listingCity && listingSubdivision
      ? neighborhoodByCitySubdivision.get(`${slugify(listingCity)}::${slugify(listingSubdivision)}`)
      : null
    result.push({
      id: e.id,
      listing_key: canonicalKey,
      ListNumber: (listing?.ListNumber ?? null) as string | null,
      mls_source: (listing?.mls_source ?? null) as string | null,
      event_type: e.event_type as ActivityFeedItem['event_type'],
      event_at: e.event_at,
      payload: (e.payload as Record<string, unknown>) ?? undefined,
      ListPrice: listing?.ListPrice as number | null,
      BedroomsTotal: listing?.BedroomsTotal as number | null,
      BathroomsTotal: listing?.BathroomsTotal as number | null,
      StreetNumber: listing?.StreetNumber as string | null,
      StreetName: listing?.StreetName as string | null,
      City: listing?.City as string | null,
      State: listing?.State as string | null,
      PostalCode: listing?.PostalCode as string | null,
      SubdivisionName: listing?.SubdivisionName as string | null,
      NeighborhoodName: neighborhoodContext?.name ?? null,
      NeighborhoodSlug: neighborhoodContext?.slug ?? null,
      PhotoURL: listing?.PhotoURL as string | null,
      StandardStatus: listing?.StandardStatus as string | null,
      OnMarketDate: listing?.OnMarketDate as string | null,
      CloseDate: listing?.CloseDate as string | null,
    })
  }
  return result
}

async function _getActivityFeedByCityUncached(
  city: string,
  subdivision: string | null,
  limit: number
): Promise<ActivityFeedItem[]> {
  return getActivityFeed({
    city,
    subdivision: subdivision ?? undefined,
    limit,
  })
}

const _getActivityFeedByCityCached = unstable_cache(
  _getActivityFeedByCityUncached,
  ['activity-feed-city-v1'],
  { revalidate: 120, tags: ['activity-feed'] }
)

export async function getActivityFeedByCityCached(
  city: string,
  subdivision?: string | null,
  limit: number = 24
): Promise<ActivityFeedItem[]> {
  return _getActivityFeedByCityCached(city.trim(), subdivision?.trim() || null, Math.min(50, Math.max(1, limit)))
}

/**
 * Activity feed for homepage: events first, then fill with newest listings (so feed always has content).
 * Dedupes by listing_key. Limit is total items returned.
 */
export async function getActivityFeedWithFallback(options: {
  city: string
  limit?: number
}): Promise<ActivityFeedItem[]> {
  const limit = Math.min(24, Math.max(6, options.limit ?? 12))
  const events = await getActivityFeed({ city: options.city, limit, offset: 0 })
  const seen = new Set(events.map((e) => e.listing_key))
  if (events.length >= limit) return events

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return events

  const supabase = createClient(url, anonKey)
  const { data: rows } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, mls_source, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, OnMarketDate, CloseDate, ModificationTimestamp')
    .ilike('City', options.city.trim())
    .or('StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%')
    .order('ModificationTimestamp', { ascending: false })
    .limit(limit * 2)
  const list = (rows ?? []) as Array<Record<string, unknown> & { ModificationTimestamp?: string }>
  const fallback: ActivityFeedItem[] = []
  for (const r of list) {
    if (fallback.length + events.length >= limit) break
    const key = (r.ListingKey ?? r.ListNumber ?? '').toString()
    if (!key || seen.has(key)) continue
    seen.add(key)
    fallback.push({
      id: `fallback-${key}`,
      listing_key: key,
      ListNumber: (r.ListNumber as string) ?? null,
      mls_source: (r.mls_source as string) ?? null,
      event_type: 'new_listing',
      event_at: (r.ModificationTimestamp ?? new Date().toISOString()) as string,
      ListPrice: r.ListPrice as number | null,
      BedroomsTotal: r.BedroomsTotal as number | null,
      BathroomsTotal: r.BathroomsTotal as number | null,
      StreetNumber: r.StreetNumber as string | null,
      StreetName: r.StreetName as string | null,
      City: r.City as string | null,
      State: r.State as string | null,
      PostalCode: r.PostalCode as string | null,
      SubdivisionName: r.SubdivisionName as string | null,
      NeighborhoodName: null,
      NeighborhoodSlug: null,
      PhotoURL: r.PhotoURL as string | null,
      StandardStatus: r.StandardStatus as string | null,
      OnMarketDate: (r.OnMarketDate as string) ?? null,
      CloseDate: (r.CloseDate as string) ?? null,
    })
  }
  return [...events, ...fallback]
}

const ACTIVE_OR_PENDING_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%'

/**
 * Activity feed for multiple cities: events first, then fill with newest listings in those cities.
 * Used by the homepage/reusable slider with default cities and optional additional cities from dropdown.
 */
async function _getActivityFeedWithFallbackMultiUncached(options: {
  cities: string[]
  limit?: number
}): Promise<ActivityFeedItem[]> {
  const limit = Math.min(24, Math.max(6, options.limit ?? 12))
  const cities = options.cities.map((c) => c.trim()).filter(Boolean)
  if (cities.length === 0) return []

  const events = await getActivityFeed({ cities, limit, offset: 0 })
  const seen = new Set(events.map((e) => e.listing_key))
  if (events.length >= limit) return events

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return events

  const supabase = createClient(url, anonKey)
  const { data: rows } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, mls_source, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName, PhotoURL, StandardStatus, OnMarketDate, CloseDate, ModificationTimestamp')
    .in('City', cities)
    .or(ACTIVE_OR_PENDING_OR)
    .order('ModificationTimestamp', { ascending: false })
    .limit(limit * 2)
  const list = (rows ?? []) as Array<Record<string, unknown> & { ModificationTimestamp?: string }>
  const fallback: ActivityFeedItem[] = []
  for (const r of list) {
    if (fallback.length + events.length >= limit) break
    const key = (r.ListingKey ?? r.ListNumber ?? '').toString()
    if (!key || seen.has(key)) continue
    seen.add(key)
    fallback.push({
      id: `fallback-${key}`,
      listing_key: key,
      ListNumber: (r.ListNumber as string) ?? null,
      mls_source: (r.mls_source as string) ?? null,
      event_type: 'new_listing',
      event_at: (r.ModificationTimestamp ?? new Date().toISOString()) as string,
      ListPrice: r.ListPrice as number | null,
      BedroomsTotal: r.BedroomsTotal as number | null,
      BathroomsTotal: r.BathroomsTotal as number | null,
      StreetNumber: r.StreetNumber as string | null,
      StreetName: r.StreetName as string | null,
      City: r.City as string | null,
      State: r.State as string | null,
      PostalCode: r.PostalCode as string | null,
      SubdivisionName: r.SubdivisionName as string | null,
      NeighborhoodName: null,
      NeighborhoodSlug: null,
      PhotoURL: r.PhotoURL as string | null,
      StandardStatus: r.StandardStatus as string | null,
      OnMarketDate: (r.OnMarketDate as string) ?? null,
      CloseDate: (r.CloseDate as string) ?? null,
    })
  }
  return [...events, ...fallback]
}

export const getActivityFeedWithFallbackMulti = unstable_cache(
  _getActivityFeedWithFallbackMultiUncached,
  ['activity-feed-multi'],
  { revalidate: 120, tags: ['activity-feed'] }
)
