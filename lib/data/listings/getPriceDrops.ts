/**
 * getPriceDrops — active SFR listings with a documented price reduction
 * within the last N days, scoped by city or region-wide.
 *
 * Shape:
 *   - current price, prior price (previous_price from the event payload),
 *     drop amount + percent, days on market, photo, address slug, reduced-at date
 *
 * getPriceDropDigest — aggregate summary shape consumed by the weekly
 * price-drop social producer (content:price_drop_digest).
 *
 * ─── DATA SOURCE (v2) ────────────────────────────────────────────────────────
 * Source: `activity_events` table, event_type = 'price_drop', event_at within
 *         the last N days. Each row carries:
 *           listing_key (text, top-level)
 *           event_at    (timestamptz)
 *           payload:    { ListNumber, previous_price, new_price }
 *
 * Listing details (photo, address, beds/baths/sqft, city, boundary fields)
 * come from a second DAL call: getListingTiles({ listingKeys, status:'all' }).
 * The MV reflects current Active status; we filter to property_type='A' (SFR)
 * and Active/Active-Under-Contract after the join.
 *
 * ⚠️  WARNING — DO NOT REVERT TO listings.last_price_change_* COLUMNS ⚠️
 * As of 2026-04-07 the columns:
 *   last_price_change_date, days_since_last_price_change,
 *   last_price_change_amount, last_price_change_pct, price_drop_count
 * are STALE. The MLS feed stopped populating them; the newest value in
 * last_price_change_date is 2026-04-07 and zero rows match a 7-day window.
 * The canonical live signal is activity_events (545+ events in the last 7
 * days as of 2026-06-09). Any future reader who sees an appealing "price_drop_count"
 * column on the listings table: it is not being updated by the sync-delta cron.
 * Use this file's approach instead.
 *
 * Caching: makeResilientCached with throw-on-error (never caches poison-null).
 * TTL: 1800s (30 min) — fresh enough for a daily-crawl magnet, light on DB.
 * Tags: [cacheTag.listings] — invalidated on any listing cache bust.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import { isServiceAreaCity } from '@/lib/data/listings/service-area'
import type { ListingTile } from '@/lib/data/types/listing'

// ─── Types ────────────────────────────────────────────────────────────────

/** One listing with a documented price reduction. */
export type PriceDrop = {
  listingKey: string
  listNumber: string | null
  streetNumber: string | null
  streetName: string | null
  city: string | null
  citySlug: string | null
  postalCode: string | null
  subdivisionName: string | null
  subdivisionSlug: string | null
  addressSlug: string | null
  lat: number | null
  lng: number | null
  photoUrl: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Current list price (from the MV tile, reflecting the post-drop price). */
  listPrice: number
  /** Original list price (previous_price from the activity event). */
  originalListPrice: number | null
  /** Dollar amount of the price reduction (positive). */
  lastDropAmount: number | null
  /** Percentage of the price reduction (positive, e.g. 3.5 means 3.5% drop). */
  lastDropPct: number | null
  /** Total % reduction from original list price (positive = cheaper than original). */
  totalDropPct: number | null
  /** Number of times the price has been reduced (from the MV tile, may be stale). */
  priceDropCount: number | null
  /** Days since the most recent price change (computed from event_at). */
  daysSinceLastChange: number | null
  /** ISO timestamp of the last price change event. */
  lastPriceChangeDate: string | null
  /** Days on market. */
  dom: number | null
  /** Boundary city (for geo grouping). */
  boundaryCity: string | null
  boundaryNeighborhood: string | null
  boundarySubdivision: string | null
}

/** Aggregate digest consumed by the price-drop social producer. */
export type PriceDropDigest = {
  /** Total listings with a price reduction in the window. */
  count: number
  /** Sum of all asking-price cuts in dollars. */
  totalReduced: number
  /** Listing with the biggest single drop (by dollar amount). */
  biggestDrop: {
    address: string
    amount: number
    pct: number
    neighborhood: string | null
    listingKey: string
  } | null
  /** Median drop % across all reduced listings. */
  medianDropPct: number | null
  /** ISO timestamp when this data was fetched. */
  fetchedAt: string
  /** City or "central-oregon" for region-wide. */
  geoLabel: string
}

export type GetPriceDropsInput = {
  /** City display name (e.g. "Bend"). Omit for region-wide. */
  city?: string
  /** Days to look back for the last price change. Default 7. Max 30. */
  days?: number
  /** Max listings to return. Default 60. Max 100. */
  limit?: number
  /** Offset for pagination. Default 0. */
  offset?: number
}

export type GetPriceDropsResult = {
  drops: PriceDrop[]
  /** Total number of drops in scope (before pagination). */
  total: number
  /** ISO timestamp of the data fetch (for dateModified in JSON-LD). */
  fetchedAt: string
}

// ─── activity_events row shape ────────────────────────────────────────────

type ActivityEventRow = {
  id: string
  listing_key: string
  event_type: string
  event_at: string
  payload: {
    ListNumber?: string | null
    previous_price?: number | null
    new_price?: number | null
  } | null
}

// ─── Tile → PriceDrop mapper ──────────────────────────────────────────────

function tileAndEventToDrop(
  tile: ListingTile,
  event: ActivityEventRow,
  nowMs: number,
): PriceDrop | null {
  const listPrice = tile.listPrice
  if (!tile.listingKey || !listPrice) return null

  const city = tile.city
  const citySlug = city ? city.toLowerCase().replace(/\s+/g, '-') : null
  const subdivisionSlug = tile.subdivisionName
    ? tile.subdivisionName.toLowerCase().replace(/\s+/g, '-')
    : null
  const addrParts = [tile.streetNumber, tile.streetName, city]
    .filter(Boolean)
    .map((s) => (s as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  const addressSlug = tile.addressSlug ?? (addrParts.length > 0 ? addrParts.join('-') : null)

  const payload = event.payload ?? {}
  const previousPrice = payload.previous_price ?? null
  const newPriceFromEvent = payload.new_price ?? null

  // Dollar drop: use event prices if available; otherwise skip (no fabrication)
  const dropAmount =
    previousPrice != null && newPriceFromEvent != null && previousPrice > newPriceFromEvent
      ? previousPrice - newPriceFromEvent
      : previousPrice != null && previousPrice > listPrice
        ? previousPrice - listPrice
        : null

  // Percent drop (positive = cheaper)
  const lastDropPct =
    dropAmount != null && previousPrice != null && previousPrice > 0
      ? (dropAmount / previousPrice) * 100
      : null

  // Total drop from original (same as last drop for one-event model)
  const totalDropPct = lastDropPct

  // Days since the event
  const eventMs = new Date(event.event_at).getTime()
  const daysSinceLastChange = isNaN(eventMs)
    ? null
    : Math.floor((nowMs - eventMs) / 86_400_000)

  return {
    listingKey: tile.listingKey,
    listNumber: tile.listNumber,
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    city,
    citySlug,
    postalCode: tile.postalCode,
    subdivisionName: tile.subdivisionName,
    subdivisionSlug,
    addressSlug,
    lat: tile.lat,
    lng: tile.lng,
    photoUrl: tile.photoUrl,
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    listPrice,
    originalListPrice: previousPrice,
    lastDropAmount: dropAmount,
    lastDropPct,
    totalDropPct,
    priceDropCount: tile.priceDropCount,
    daysSinceLastChange,
    lastPriceChangeDate: event.event_at,
    dom: tile.dom,
    boundaryCity: tile.boundaryCity,
    boundaryNeighborhood: tile.boundaryNeighborhood,
    boundarySubdivision: tile.boundarySubdivision,
  }
}

// ─── Core fetch ───────────────────────────────────────────────────────────

async function fetchPriceDrops(
  input: GetPriceDropsInput,
): Promise<GetPriceDropsResult> {
  const fetchedAt = new Date().toISOString()
  const nowMs = Date.now()
  const limit = Math.min(input.limit ?? 60, 100)
  const offset = input.offset ?? 0
  const days = Math.min(input.days ?? 7, 30)
  const city = input.city?.trim()

  // Region cap = 60, city cap = 40
  const regionCap = city ? 40 : 60

  const supabase = supabaseAnon()
  if (!supabase) return { drops: [], total: 0, fetchedAt }

  // ── Step 1: Fetch price_drop events from the last N days ─────────────────
  // activity_events has: id, listing_key, event_type, event_at, payload
  // Fetch more than we need before filtering by city, since we join to tiles
  const windowStart = new Date(nowMs - days * 86_400_000).toISOString()

  const { data: rawEvents, error: eventsError } = await supabase
    .from('activity_events')
    .select('id, listing_key, event_type, event_at, payload')
    .eq('event_type', 'price_drop')
    .gte('event_at', windowStart)
    .order('event_at', { ascending: false })
    .limit(1000) // generous buffer: fetch all, filter after join

  if (eventsError) {
    throw new Error(`[getPriceDrops] activity_events query error: ${eventsError.message}`)
  }

  if (!rawEvents || rawEvents.length === 0) {
    return { drops: [], total: 0, fetchedAt }
  }

  const events = rawEvents as ActivityEventRow[]

  // Dedupe to the most recent event per ListingKey
  const latestByKey = new Map<string, ActivityEventRow>()
  for (const ev of events) {
    if (!ev.listing_key) continue
    if (!latestByKey.has(ev.listing_key)) {
      latestByKey.set(ev.listing_key, ev)
    }
  }

  const listingKeys = [...latestByKey.keys()]
  if (listingKeys.length === 0) return { drops: [], total: 0, fetchedAt }

  // ── Step 2: Fetch listing tiles for the deduped keys ─────────────────────
  // status:'all' so we get the current price and photo even if the listing
  // has moved to Pending since the event. We'll filter to Active SFR next.
  const tiles = await getListingTiles({
    listingKeys,
    status: 'all',
    sort: 'newest',
    limit: listingKeys.length,
  })

  // Index tiles by listingKey
  const tileByKey = new Map<string, ListingTile>()
  for (const tile of tiles) {
    tileByKey.set(tile.listingKey, tile)
  }

  // ── Step 3: Join + filter ─────────────────────────────────────────────────
  const SFR_TYPE = 'A'
  const ACTIVE_STATUSES = new Set(['Active', 'Active Under Contract'])

  const joined: PriceDrop[] = []
  for (const [key, event] of latestByKey.entries()) {
    const tile = tileByKey.get(key)
    if (!tile) continue

    // SFR only
    if (tile.propertyType !== SFR_TYPE) continue

    // Active or Active-Under-Contract only
    if (!ACTIVE_STATUSES.has(tile.status)) continue

    // Must have a photo
    if (!tile.photoUrl) continue

    // City filter
    if (city && tile.city?.toLowerCase() !== city.toLowerCase()) continue

    // Service-area guard (audit P0-3 2026-06-10): activity_events arrive
    // feed-wide (statewide MLS), so the region-wide pull (no city) must scope
    // to the Central Oregon allowlist — a Winston, OR (Douglas County) drop
    // was live on /price-drops the day of the audit.
    if (!city && !isServiceAreaCity(tile.city)) continue

    const drop = tileAndEventToDrop(tile, event, nowMs)
    if (!drop) continue

    joined.push(drop)
  }

  // ── Step 4: Sort by drop percent descending, cap at regionCap ─────────────
  joined.sort((a, b) => (b.lastDropPct ?? 0) - (a.lastDropPct ?? 0))
  const capped = joined.slice(0, regionCap)

  const total = capped.length
  const page = capped.slice(offset, offset + limit)

  return { drops: page, total, fetchedAt }
}

// ─── Digest (aggregate for social producer) ───────────────────────────────

async function fetchPriceDropDigest(
  cityOrRegion: string,
  days: number,
): Promise<PriceDropDigest> {
  const fetchedAt = new Date().toISOString()
  const safeDays = Math.min(Math.max(days, 1), 30)
  const isRegion = cityOrRegion === 'central-oregon' || !cityOrRegion

  const input: GetPriceDropsInput = {
    city: isRegion ? undefined : cityOrRegion,
    days: safeDays,
    limit: 100,
    offset: 0,
  }

  const { drops } = await fetchPriceDrops(input)

  if (drops.length === 0) {
    return {
      count: 0,
      totalReduced: 0,
      biggestDrop: null,
      medianDropPct: null,
      fetchedAt,
      geoLabel: isRegion ? 'central-oregon' : cityOrRegion,
    }
  }

  // Total dollars reduced across all drops
  const totalReduced = drops.reduce((sum, d) => sum + (d.lastDropAmount ?? 0), 0)

  // Biggest drop by dollar amount
  const sorted = [...drops].sort(
    (a, b) => (b.lastDropAmount ?? 0) - (a.lastDropAmount ?? 0),
  )
  const top = sorted[0]
  const biggestDrop = top
    ? {
        address: [top.streetNumber, top.streetName].filter(Boolean).join(' ') || 'Address on request',
        amount: top.lastDropAmount ?? 0,
        pct: top.lastDropPct ?? 0,
        neighborhood: top.boundaryNeighborhood ?? top.subdivisionName ?? null,
        listingKey: top.listingKey,
      }
    : null

  // Median drop pct
  const pcts = drops
    .map((d) => d.lastDropPct)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b)
  const mid = Math.floor(pcts.length / 2)
  const medianDropPct =
    pcts.length === 0
      ? null
      : pcts.length % 2 === 0
        ? (pcts[mid - 1] + pcts[mid]) / 2
        : pcts[mid]

  return {
    count: drops.length,
    totalReduced: Math.round(totalReduced / 1000) * 1000, // round to $1K
    biggestDrop,
    medianDropPct: medianDropPct !== null ? Math.round(medianDropPct * 10) / 10 : null,
    fetchedAt,
    geoLabel: isRegion ? 'central-oregon' : cityOrRegion,
  }
}

// ─── Cached public entry points ───────────────────────────────────────────

/**
 * Fetch active SFR listings with a documented price reduction.
 * Throws on DB error — never caches poison-null.
 * TTL: 1800s (30 min).
 *
 * Sources from activity_events (event_type='price_drop') — NOT from the
 * listings.last_price_change_* columns which are stale since 2026-04-07.
 */
export const getPriceDrops = (
  input: GetPriceDropsInput = {},
): Promise<GetPriceDropsResult> => {
  const key = JSON.stringify({
    city: input.city?.toLowerCase().trim() ?? null,
    days: input.days ?? 7,
    limit: input.limit ?? 60,
    offset: input.offset ?? 0,
  })
  return makeResilientCached(
    () => fetchPriceDrops(input),
    // v3 (2026-06-10, audit P0-3): region-wide pull now scoped to the Central
    // Oregon service area — evict entries holding out-of-area drops.
    ['price-drops-v3', key],
    { revalidate: 1800, tags: [cacheTag.listings] },
    { drops: [], total: 0, fetchedAt: new Date().toISOString() },
  )()
}

/**
 * Aggregate digest for the price-drop social producer.
 * cityOrRegion: city display name (e.g. "Bend") or "central-oregon" for region-wide.
 * days: look-back window. Default 7.
 * Throws on DB error — never caches poison-null.
 * TTL: 3600s (1 h) — weekly producer doesn't need sub-hour freshness.
 *
 * Sources from activity_events — see getPriceDrops for data-source rationale.
 */
export const getPriceDropDigest = (
  cityOrRegion: string = 'central-oregon',
  days: number = 7,
): Promise<PriceDropDigest> => {
  const key = `${cityOrRegion.toLowerCase()}-${days}d`
  return makeResilientCached(
    () => fetchPriceDropDigest(cityOrRegion, days),
    // v3 (2026-06-10, audit P0-3): same service-area eviction as price-drops-v3.
    ['price-drop-digest-v3', key],
    { revalidate: 3600, tags: [cacheTag.listings] },
    {
      count: 0,
      totalReduced: 0,
      biggestDrop: null,
      medianDropPct: null,
      fetchedAt: new Date().toISOString(),
      geoLabel: cityOrRegion,
    },
  )()
}
