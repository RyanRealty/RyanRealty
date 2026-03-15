'use server'

import { createClient } from '@supabase/supabase-js'

/** Default cities for the activity feed slider (home and reusable section). User can add more via dropdown. */
export const ACTIVITY_FEED_DEFAULT_CITIES = [
  'Bend',
  'Redmond',
  'La Pine',
  'Sunriver',
  'Sisters',
  'Tumalo',
  'Terrebonne',
  'Madras',
  'Prineville',
  'Crooked River Ranch',
] as const

export type ActivityFeedItem = {
  id: string
  listing_key: string
  event_type: 'new_listing' | 'price_drop' | 'status_pending' | 'status_closed'
  event_at: string
  payload?: Record<string, unknown>
  ListPrice?: number | null
  BedroomsTotal?: number | null
  BathroomsTotal?: number | null
  StreetNumber?: string | null
  StreetName?: string | null
  City?: string | null
  SubdivisionName?: string | null
  PhotoURL?: string | null
  StandardStatus?: string | null
}

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
  limit?: number
  offset?: number
}): Promise<ActivityFeedItem[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const limit = Math.min(50, Math.max(1, options?.limit ?? 12))
  const offset = Math.max(0, options?.offset ?? 0)
  const supabase = createClient(url, anonKey)

  const { data: events } = await supabase
    .from('activity_events')
    .select('id, listing_key, event_type, event_at, payload')
    .order('event_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (!events?.length) return []

  const keys = [...new Set((events as { listing_key: string }[]).map((e) => e.listing_key).filter(Boolean))]
  const [byNum, byKeyRes] = await Promise.all([
    supabase.from('listings').select('ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, SubdivisionName, PhotoURL, StandardStatus').in('ListNumber', keys),
    supabase.from('listings').select('ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, SubdivisionName, PhotoURL, StandardStatus').in('ListingKey', keys),
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
  const citySet = options?.cities?.length
    ? new Set(options.cities.map((c) => c.trim()).filter(Boolean))
    : null
  const singleCity = options?.city?.trim() || null
  const result: ActivityFeedItem[] = []
  const subdivisionFilter = options?.subdivision?.trim().toLowerCase()
  for (const e of events as { id: string; listing_key: string; event_type: string; event_at: string; payload?: unknown }[]) {
    const listing = byKey.get(e.listing_key)
    const listingCity = (listing?.City ?? '').toString().trim()
    if (citySet && !citySet.has(listingCity)) continue
    if (singleCity && !citySet && listingCity !== singleCity) continue
    if (subdivisionFilter) {
      const sub = (listing?.SubdivisionName ?? '').toString().trim().toLowerCase()
      if (!sub || (!sub.includes(subdivisionFilter) && sub !== subdivisionFilter)) continue
    }
    result.push({
      id: e.id,
      listing_key: e.listing_key,
      event_type: e.event_type as ActivityFeedItem['event_type'],
      event_at: e.event_at,
      payload: (e.payload as Record<string, unknown>) ?? undefined,
      ListPrice: listing?.ListPrice as number | null,
      BedroomsTotal: listing?.BedroomsTotal as number | null,
      BathroomsTotal: listing?.BathroomsTotal as number | null,
      StreetNumber: listing?.StreetNumber as string | null,
      StreetName: listing?.StreetName as string | null,
      City: listing?.City as string | null,
      SubdivisionName: listing?.SubdivisionName as string | null,
      PhotoURL: listing?.PhotoURL as string | null,
      StandardStatus: listing?.StandardStatus as string | null,
    })
  }
  return result
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
    .select('ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, SubdivisionName, PhotoURL, StandardStatus, ModificationTimestamp')
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
      event_type: 'new_listing',
      event_at: (r.ModificationTimestamp ?? new Date().toISOString()) as string,
      ListPrice: r.ListPrice as number | null,
      BedroomsTotal: r.BedroomsTotal as number | null,
      BathroomsTotal: r.BathroomsTotal as number | null,
      StreetNumber: r.StreetNumber as string | null,
      StreetName: r.StreetName as string | null,
      City: r.City as string | null,
      SubdivisionName: r.SubdivisionName as string | null,
      PhotoURL: r.PhotoURL as string | null,
      StandardStatus: r.StandardStatus as string | null,
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
export async function getActivityFeedWithFallbackMulti(options: {
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
    .select('ListingKey, ListNumber, ListPrice, BedroomsTotal, BathroomsTotal, StreetNumber, StreetName, City, SubdivisionName, PhotoURL, StandardStatus, ModificationTimestamp')
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
      event_type: 'new_listing',
      event_at: (r.ModificationTimestamp ?? new Date().toISOString()) as string,
      ListPrice: r.ListPrice as number | null,
      BedroomsTotal: r.BedroomsTotal as number | null,
      BathroomsTotal: r.BathroomsTotal as number | null,
      StreetNumber: r.StreetNumber as string | null,
      StreetName: r.StreetName as string | null,
      City: r.City as string | null,
      SubdivisionName: r.SubdivisionName as string | null,
      PhotoURL: r.PhotoURL as string | null,
      StandardStatus: r.StandardStatus as string | null,
    })
  }
  return [...events, ...fallback]
}
