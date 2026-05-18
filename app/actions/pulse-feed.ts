'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import type { ActivityFeedItem } from './activity-feed-shared'
import { PULSE_DEFAULT_CITIES } from '@/lib/pulse-config'

const QUERY_TIMEOUT_MS = 25_000

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[pulse-feed] ${label} exceeded ${ms}ms — returning fallback`)
          resolve(fallback)
        }, ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export type PulseFeedItem = ActivityFeedItem & {
  TotalLivingAreaSqFt?: number | null
  ListAgentName?: string | null
  ListOfficeName?: string | null
  virtual_tour_url?: string | null
  has_virtual_tour?: boolean | null
  sale_to_list_ratio?: number | null
  days_to_pending?: number | null
  last_price_change_pct?: number | null
  last_price_change_amount?: number | null
  original_list_price?: number | null
}

export type PulseRegionSnapshot = {
  geo_slug: string
  geo_label: string
  active_count: number
  median_list_price: number | null
  months_of_supply: number | null
  market_health_label: string | null
  sold_count_30d: number
  new_count_7d: number
  median_active_dom: number | null
  updated_at: string | null
}

export type PulseCitySnapshot = PulseRegionSnapshot

const PULSE_EVENT_TYPES = [
  'new_listing',
  'price_drop',
  'status_pending',
  'status_closed',
  'back_on_market',
] as const

export type PulseEventType = (typeof PULSE_EVENT_TYPES)[number]

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null
  return createClient(url, anonKey)
}

export type PulseFeedQuery = {
  cities?: string[] | null
  eventTypes?: PulseEventType[] | null
  offset?: number
  limit?: number
}

export type PulseFeedResult = {
  items: PulseFeedItem[]
  nextOffset: number | null
}

const LISTING_SELECT = [
  'ListingKey, ListNumber, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal',
  'TotalLivingAreaSqFt, StreetNumber, StreetName, City, State, PostalCode, SubdivisionName',
  'PhotoURL, StandardStatus, OnMarketDate, CloseDate, ClosePrice',
  'ListAgentName, ListOfficeName',
  'virtual_tour_url, has_virtual_tour, sale_to_list_ratio, days_to_pending',
  'last_price_change_pct, last_price_change_amount',
].join(', ')

/**
 * Activity events joined to listings + video data. Filtered by city and event type.
 * Pages through results via offset; nextOffset is null when exhausted.
 * Activity events are stored with listing_key OR ListNumber, so both are resolved
 * in a single .or() round trip.
 */
export async function getPulseFeed(options: PulseFeedQuery): Promise<PulseFeedResult> {
  const supabase = supabaseClient()
  if (!supabase) return { items: [], nextOffset: null }

  const limit = Math.min(40, Math.max(6, options.limit ?? 12))
  const offset = Math.max(0, options.offset ?? 0)
  // "All cities" in the UI means "all Central Oregon cities" — we never want to
  // surface listings outside the region. Caller-supplied cities override the default.
  const cities = (options.cities && options.cities.length > 0)
    ? options.cities.map((c) => c.trim()).filter(Boolean)
    : [...PULSE_DEFAULT_CITIES]
  const requestedTypes = (options.eventTypes ?? []).filter((t): t is PulseEventType =>
    (PULSE_EVENT_TYPES as readonly string[]).includes(t)
  )
  const eventTypes = requestedTypes.length > 0 ? requestedTypes : [...PULSE_EVENT_TYPES]

  // Buffer 4x the requested page so city + photo filters still yield a full page.
  const eventBuffer = Math.min(120, limit * 4)
  const eventsResult = await withTimeout(
    supabase
      .from('activity_events')
      .select('id, listing_key, event_type, event_at, payload')
      .in('event_type', eventTypes)
      .order('event_at', { ascending: false })
      .range(offset, offset + eventBuffer - 1)
      .then((r) => r),
    QUERY_TIMEOUT_MS,
    { data: null, error: null } as unknown as { data: unknown[] | null; error: { message: string } | null },
    'activity_events query'
  )
  const events = eventsResult?.data ?? null

  if (!events?.length) return { items: [], nextOffset: null }

  const keys = [
    ...new Set(
      (events as { listing_key: string }[]).map((e) => e.listing_key).filter(Boolean)
    ),
  ]

  // Single round-trip: match by ListingKey OR ListNumber. Activity events store
  // either form depending on the source. PostgREST `.or()` accepts CSV with quoted values.
  const keyList = keys.map((k) => `"${k}"`).join(',')
  const listingsResult = await withTimeout(
    supabase
      .from('listings')
      .select(LISTING_SELECT)
      .or(`ListingKey.in.(${keyList}),ListNumber.in.(${keyList})`)
      .then((r) => r),
    QUERY_TIMEOUT_MS,
    { data: null, error: null } as unknown as { data: unknown[] | null; error: { message: string } | null },
    'listings join'
  )
  const listingRows = listingsResult?.data ?? null

  const listingByKey = new Map<string, Record<string, unknown>>()
  for (const r of listingRows ?? []) {
    const row = r as Record<string, unknown>
    const num = (row.ListNumber ?? '').toString().trim()
    const key = (row.ListingKey ?? '').toString().trim()
    if (num) listingByKey.set(num, row)
    if (key) listingByKey.set(key, row)
  }

  const cityFilter = cities.length
    ? new Set(cities.map((c) => c.toLowerCase()))
    : null

  const items: PulseFeedItem[] = []
  for (const e of events as Array<{
    id: string
    listing_key: string
    event_type: string
    event_at: string
    payload?: Record<string, unknown>
  }>) {
    if (items.length >= limit) break
    const listing = listingByKey.get(e.listing_key)
    if (!listing) continue
    const listingCity = (listing.City as string | null | undefined)?.trim() ?? null
    if (cityFilter && (!listingCity || !cityFilter.has(listingCity.toLowerCase()))) continue
    if (!listing.PhotoURL) continue

    const canonicalKey =
      (listing.ListingKey as string | undefined)?.toString().trim() ||
      (listing.ListNumber as string | undefined)?.toString().trim() ||
      e.listing_key
    if (!canonicalKey) continue

    items.push({
      id: e.id,
      listing_key: canonicalKey,
      ListNumber: (listing.ListNumber as string | null | undefined) ?? null,
      event_type: e.event_type as ActivityFeedItem['event_type'],
      event_at: e.event_at,
      payload: (e.payload as Record<string, unknown>) ?? undefined,
      ListPrice: (listing.ListPrice as number | null | undefined) ?? null,
      original_list_price: (listing.OriginalListPrice as number | null | undefined) ?? null,
      BedroomsTotal: (listing.BedroomsTotal as number | null | undefined) ?? null,
      BathroomsTotal: (listing.BathroomsTotal as number | null | undefined) ?? null,
      TotalLivingAreaSqFt: (listing.TotalLivingAreaSqFt as number | null | undefined) ?? null,
      ListAgentName: (listing.ListAgentName as string | null | undefined) ?? null,
      ListOfficeName: (listing.ListOfficeName as string | null | undefined) ?? null,
      StreetNumber: (listing.StreetNumber as string | null | undefined) ?? null,
      StreetName: (listing.StreetName as string | null | undefined) ?? null,
      City: listingCity,
      State: (listing.State as string | null | undefined) ?? null,
      PostalCode: (listing.PostalCode as string | null | undefined) ?? null,
      SubdivisionName: (listing.SubdivisionName as string | null | undefined) ?? null,
      NeighborhoodName: null,
      NeighborhoodSlug: null,
      PhotoURL: (listing.PhotoURL as string | null | undefined) ?? null,
      StandardStatus: (listing.StandardStatus as string | null | undefined) ?? null,
      OnMarketDate: (listing.OnMarketDate as string | null | undefined) ?? null,
      CloseDate: (listing.CloseDate as string | null | undefined) ?? null,
      virtual_tour_url: (listing.virtual_tour_url as string | null | undefined) ?? null,
      has_virtual_tour: (listing.has_virtual_tour as boolean | null | undefined) ?? null,
      sale_to_list_ratio: (listing.sale_to_list_ratio as number | null | undefined) ?? null,
      days_to_pending: (listing.days_to_pending as number | null | undefined) ?? null,
      last_price_change_pct: (listing.last_price_change_pct as number | null | undefined) ?? null,
      last_price_change_amount: (listing.last_price_change_amount as number | null | undefined) ?? null,
    })
  }

  // Variable-reward sequencing: gently reorder so no two consecutive cards share
  // the same event_type. Keeps the chronological feel (within ~3 positions) but
  // breaks repetitive runs that kill scroll engagement.
  const sequenced = diversifyByEventType(items)

  const scannedAll = (events?.length ?? 0) < eventBuffer
  const nextOffset = scannedAll && sequenced.length < limit ? null : offset + (events?.length ?? 0)
  return { items: sequenced, nextOffset }
}

function diversifyByEventType(items: PulseFeedItem[]): PulseFeedItem[] {
  if (items.length < 3) return items
  const result: PulseFeedItem[] = []
  const queue = [...items]
  while (queue.length > 0) {
    const last = result[result.length - 1]
    const idx = last
      ? queue.findIndex((it) => it.event_type !== last.event_type)
      : 0
    if (idx === -1) {
      // Everything left matches; just append.
      result.push(queue.shift()!)
    } else {
      result.push(queue.splice(idx, 1)[0])
    }
  }
  return result
}

const REGION_SLUG = 'central-oregon'

async function _getRegionSnapshotUncached(): Promise<PulseRegionSnapshot | null> {
  const supabase = supabaseClient()
  if (!supabase) return null
  const result = await withTimeout(
    supabase
      .from('market_pulse_live')
      .select(
        'geo_slug, geo_label, active_count, median_list_price, months_of_supply, market_health_label, sold_count_30d, new_count_7d, median_active_dom, updated_at'
      )
      .eq('geo_type', 'region')
      .eq('property_type', 'A')
      .eq('geo_slug', REGION_SLUG)
      .maybeSingle()
      .then((r) => r),
    QUERY_TIMEOUT_MS,
    { data: null, error: null } as unknown as { data: unknown | null; error: { message: string } | null },
    'region snapshot'
  )
  const data = result?.data as Record<string, unknown> | null
  if (!data) return null
  return {
    geo_slug: String(data.geo_slug ?? ''),
    geo_label: String(data.geo_label ?? ''),
    active_count: Number(data.active_count ?? 0),
    median_list_price: data.median_list_price != null ? Number(data.median_list_price) : null,
    months_of_supply: data.months_of_supply != null ? Number(data.months_of_supply) : null,
    market_health_label: (data.market_health_label as string | null) ?? null,
    sold_count_30d: Number(data.sold_count_30d ?? 0),
    new_count_7d: Number(data.new_count_7d ?? 0),
    median_active_dom: data.median_active_dom != null ? Number(data.median_active_dom) : null,
    updated_at: (data.updated_at as string | null) ?? null,
  }
}

export const getPulseRegionSnapshot = unstable_cache(_getRegionSnapshotUncached, ['pulse-region-snapshot-v1'], {
  revalidate: 600,
  tags: ['pulse-snapshot'],
})

/**
 * Pulls a city's market snapshot for the interstitial. Cities arrive as display labels
 * (e.g. "Bend") and resolve against geo_label rather than geo_slug.
 */
async function _getCitySnapshotsUncached(cityLabels: string[]): Promise<PulseCitySnapshot[]> {
  const supabase = supabaseClient()
  if (!supabase || cityLabels.length === 0) return []
  const result = await withTimeout(
    supabase
      .from('market_pulse_live')
      .select(
        'geo_slug, geo_label, active_count, median_list_price, months_of_supply, market_health_label, sold_count_30d, new_count_7d, median_active_dom, updated_at'
      )
      .eq('geo_type', 'city')
      .eq('property_type', 'A')
      .in('geo_label', cityLabels)
      .then((r) => r),
    QUERY_TIMEOUT_MS,
    { data: null, error: null } as unknown as { data: unknown[] | null; error: { message: string } | null },
    'city snapshots'
  )
  const rows = (result?.data ?? []) as Array<Record<string, unknown>>
  return rows
    .map((d) => ({
      geo_slug: d.geo_slug as string,
      geo_label: d.geo_label as string,
      active_count: Number((d.active_count as number | null) ?? 0),
      median_list_price: d.median_list_price != null ? Number(d.median_list_price) : null,
      months_of_supply: d.months_of_supply != null ? Number(d.months_of_supply) : null,
      market_health_label: (d.market_health_label as string | null) ?? null,
      sold_count_30d: Number((d.sold_count_30d as number | null) ?? 0),
      new_count_7d: Number((d.new_count_7d as number | null) ?? 0),
      median_active_dom: d.median_active_dom != null ? Number(d.median_active_dom) : null,
      updated_at: (d.updated_at as string | null) ?? null,
    }))
    .filter((row) => row.active_count > 0)
    .sort((a, b) => b.active_count - a.active_count)
}

export const getPulseCitySnapshots = unstable_cache(_getCitySnapshotsUncached, ['pulse-city-snapshots-v1'], {
  revalidate: 600,
  tags: ['pulse-snapshot'],
})

// keep import referenced for typing convenience
export type PulseDefaultCitiesList = typeof PULSE_DEFAULT_CITIES
