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
 *         the last N days, read in 1,000-row pages (PostgREST answers no
 *         more than that per request). Each row carries:
 *           listing_key (text, top-level)
 *           event_at    (timestamptz)
 *           payload:    { ListNumber, previous_price, new_price }
 *
 * Listing details (photo, address, beds/baths/sqft, city, boundary fields)
 * come from a second DAL call: getListingTiles({ listingKeys, status:'all' }).
 * The MV reflects current Active status; after the join we keep single-family
 * homes (property_type 'A' AND property_sub_type 'Single Family Residence',
 * MARKET_TRUTH D1; bare 'A' is the whole Residential bucket, condos,
 * townhomes and manufactured homes included) that are Active or Active Under
 * Contract.
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
 * A read that did not answer (an events error, no client, or no tiles back
 * for a non-empty key list) throws, and the public fallback carries
 * `degraded: true`, so a page can say it could not load instead of printing
 * an empty week. A genuinely empty window is a real answer, `degraded: false`.
 * TTL: 1800s (30 min) — fresh enough for a daily-crawl magnet, light on DB.
 * Tags: [cacheTag.listings] — invalidated on any listing cache bust.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { fetchPagedRows } from '@/lib/supabase/paginate'
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
  /** Street suffix (Loop/Rd/Ct) from the tile MV — display-only, never in slugs. */
  streetSuffix: string | null
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
  /**
   * True only on the resilient-cache fallback: the read did not answer, so
   * `count: 0` is unknown, not zero (§0). A genuinely empty window is false.
   */
  degraded: boolean
}

export type GetPriceDropsInput = {
  /** City display name (e.g. "Bend"). Omit for region-wide. */
  city?: string
  /** Days to look back for the last price change. Default 7. Max 30. */
  days?: number
  /** Max listings to return. Default 60. Max 100. The list's only cap. */
  limit?: number
  /** Offset for pagination. Default 0. */
  offset?: number
}

export type GetPriceDropsResult = {
  drops: PriceDrop[]
  /** Every drop in scope that cleared the filters: the population, never the cap. */
  total: number
  /**
   * The most drops one read returns (`limit`, max 100). When `total` exceeds
   * it, `drops` is the deepest `cap` cuts and the rest are counted, not listed.
   */
  cap: number
  /** ISO timestamp of the data fetch (for dateModified in JSON-LD). */
  fetchedAt: string
  /**
   * True only on the resilient-cache fallback: the read did not answer, so the
   * empty `drops` and `total: 0` are unknown, not an empty window (§0). A page
   * says it could not load and publishes no count, Dataset or stamp. A
   * genuinely empty window is a successful read: `degraded: false`.
   */
  degraded: boolean
}

// ─── activity_events row shape ────────────────────────────────────────────

export type ActivityEventRow = {
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

// Exported for unit tests (was→now→% consistency lock, §0). Not part of the
// public DAL surface — callers use getPriceDrops / getPriceDropDigest.
export function tileAndEventToDrop(
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

  // A listing is a CURRENT price drop only when its current list price is below
  // the price before the change. Compute the drop from previousPrice → current
  // listPrice so the displayed "was → now → %" are always self-consistent.
  //
  // The old logic took the % from the event's new_price, which diverged from the
  // current price when a listing RECOVERED or was RELISTED: 18575 Century Drive
  // showed "was $299K, -23.4%" while currently listed at $299,000 — the event
  // dropped it to $229K, then it went back to $299K, so it is not currently
  // reduced at all (Matt report 2026-07-12). An unverifiable / non-current drop
  // does not ship (§0 data accuracy) — return null so it is excluded.
  if (previousPrice == null || previousPrice <= listPrice) return null

  const dropAmount = previousPrice - listPrice
  const lastDropPct = (dropAmount / previousPrice) * 100

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
    streetSuffix: tile.streetSuffix ?? null,
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

/**
 * Ceiling on price_drop events read for one window. A window is at most 30
 * days; on 2026-09-24 the 1,001st newest price_drop event (feed-wide) was
 * stamped 2026-09-10, so 1,000 events span about two weeks and a 30-day window
 * sits far below this. It exists so a bad range cannot page forever; reaching
 * it is a failed read, never a count (see below).
 */
const MAX_EVENTS = 20_000

/** The list's row cap: the caller's `limit`, default 60, never above 100. */
function listCap(input: GetPriceDropsInput): number {
  return Math.min(input.limit ?? 60, 100)
}

/**
 * Every drop in the window that clears the filters, deepest cut first. This is
 * the population behind `total` and the digest; callers cap it, never this.
 * THROWS when a read did not answer, so a failure is never cached as an empty
 * week.
 */
async function fetchQualifyingDrops(
  city: string | undefined,
  days: number,
  nowMs: number,
): Promise<PriceDrop[]> {
  const supabase = supabaseAnon()
  // No client means the read never happened, not that nothing dropped (§0).
  if (!supabase) throw new Error('[getPriceDrops] supabase anon client missing')

  // ── Step 1: Fetch price_drop events from the last N days ─────────────────
  // activity_events has: id, listing_key, event_type, event_at, payload
  // Every event in the window, then filter after the tile join. PostgREST
  // answers at most 1,000 rows per request, so the read is paged: the old
  // single `.limit(1000)` silently dropped the oldest events past that, and
  // a 30-day window already holds more than 1,000.
  const windowStart = new Date(nowMs - days * 86_400_000).toISOString()

  const { rows: events, error: eventsError } = await fetchPagedRows<ActivityEventRow>(
    (from, to) =>
      supabase
        .from('activity_events')
        .select('id, listing_key, event_type, event_at, payload')
        .eq('event_type', 'price_drop')
        .gte('event_at', windowStart)
        // Stable total order: a paged read without one repeats and skips rows.
        .order('event_at', { ascending: false })
        .order('listing_key', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    MAX_EVENTS,
  )

  if (eventsError) {
    throw new Error(`[getPriceDrops] activity_events query error: ${eventsError.message}`)
  }
  // At the ceiling the oldest events may be missing, and a count built on a
  // partial window is the undercount the paging exists to stop.
  if (events.length >= MAX_EVENTS) {
    throw new Error(`[getPriceDrops] ${events.length} price_drop events in ${days} days reached the read ceiling`)
  }

  if (events.length === 0) return []

  // Dedupe to the most recent event per ListingKey
  const latestByKey = new Map<string, ActivityEventRow>()
  for (const ev of events) {
    if (!ev.listing_key) continue
    if (!latestByKey.has(ev.listing_key)) {
      latestByKey.set(ev.listing_key, ev)
    }
  }

  const listingKeys = [...latestByKey.keys()]
  if (listingKeys.length === 0) return []

  // ── Step 2: Fetch listing tiles for the deduped keys ─────────────────────
  // status:'all' so we get the current price and photo even if the listing
  // has moved to Pending since the event. We'll filter to Active SFR next.
  // One call: getListingTiles splits the keys into URL-safe chunks itself and
  // answers all or nothing, so an empty answer below means the whole read.
  const tiles = await getListingTiles({
    listingKeys,
    status: 'all',
    sort: 'newest',
    limit: listingKeys.length,
  })

  // getListingTiles never throws: a read that fails twice resolves to its
  // fallback `[]`. Every key here is a listing the feed just re-priced, so no
  // tile at all for a non-empty key list is that failure, not a quiet week.
  // Returning it would cache "Nothing in this window" for 30 minutes.
  if (tiles.length === 0) {
    throw new Error(`[getPriceDrops] no listing tiles came back for ${listingKeys.length} listing keys`)
  }

  // Index tiles by listingKey
  const tileByKey = new Map<string, ListingTile>()
  for (const tile of tiles) {
    tileByKey.set(tile.listingKey, tile)
  }

  // ── Step 3: Join + filter ─────────────────────────────────────────────────
  // Single family is MARKET_TRUTH D1: property_type 'A' AND this sub type.
  // 'A' alone is the whole Residential bucket, and it put condos, townhomes
  // and manufactured homes on a page that says single-family.
  const SFR_TYPE = 'A'
  const SFR_SUB_TYPE = 'Single Family Residence'
  const ACTIVE_STATUSES = new Set(['Active', 'Active Under Contract'])

  const joined: PriceDrop[] = []
  for (const [key, event] of latestByKey.entries()) {
    const tile = tileByKey.get(key)
    if (!tile) continue

    // SFR only
    if (tile.propertyType !== SFR_TYPE || tile.propertySubType !== SFR_SUB_TYPE) continue

    // Active or Active-Under-Contract only
    if (!ACTIVE_STATUSES.has(tile.status)) continue

    // Must have a photo
    if (!tile.photoUrl) continue

    // Sanity floor (design-audit P1): $1,000 "homes" (fractional shares, feed
    // glitches) led the grid and poisoned the per-city medians. No real
    // Central Oregon SFR lists under $50K.
    if ((tile.listPrice ?? 0) < 50_000) continue

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

  // ── Step 4: Sort by drop percent descending ───────────────────────────────
  joined.sort((a, b) => (b.lastDropPct ?? 0) - (a.lastDropPct ?? 0))
  return joined
}

async function fetchPriceDrops(
  input: GetPriceDropsInput,
): Promise<GetPriceDropsResult> {
  const fetchedAt = new Date().toISOString()
  const nowMs = Date.now()
  const cap = listCap(input)
  const offset = input.offset ?? 0
  const days = Math.min(input.days ?? 7, 30)
  const city = input.city?.trim()

  const qualifying = await fetchQualifyingDrops(city, days, nowMs)

  // `total` is the FULL population that cleared every filter, not the size of
  // the capped page. /price-drops headlines this number and appends "· N shown
  // below" when it exceeds the rendered list, so returning `capped.length` made
  // the cap masquerade as the count: on 2026-09-15 the region had 259
  // qualifying cuts and the page announced 60. The rendered list stays capped.
  //
  // `limit` is the only cap. A second, hidden one (60 region-wide, 40 per
  // city) used to cut under it, so /price-drops/bend asked for 48, listed 40,
  // and told the drawing the pull was capped at 48. The cap goes back to the
  // caller as `cap`, so the trace can only state the cut that was made.
  return {
    drops: qualifying.slice(offset, offset + cap),
    total: qualifying.length,
    cap,
    fetchedAt,
    degraded: false,
  }
}

// ─── Digest (aggregate for social producer) ───────────────────────────────

async function fetchPriceDropDigest(
  cityOrRegion: string,
  days: number,
): Promise<PriceDropDigest> {
  const fetchedAt = new Date().toISOString()
  const safeDays = Math.min(Math.max(days, 1), 30)
  const isRegion = cityOrRegion === 'central-oregon' || !cityOrRegion

  // The whole window, not a capped list: `count` is how many homes cut their
  // price, and the dollar sum, the biggest cut and the median cover every one
  // of them. This read went through the page's list and counted its cap (60
  // region-wide, 40 per city), so a busy week reported the cap as the count.
  const drops = await fetchQualifyingDrops(
    isRegion ? undefined : cityOrRegion.trim(),
    safeDays,
    Date.now(),
  )

  if (drops.length === 0) {
    return {
      count: 0,
      totalReduced: 0,
      biggestDrop: null,
      medianDropPct: null,
      fetchedAt,
      geoLabel: isRegion ? 'central-oregon' : cityOrRegion,
      degraded: false,
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
        address: [top.streetNumber, top.streetName, top.streetSuffix].filter(Boolean).join(' ') || 'Address on request',
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
    degraded: false,
  }
}

// ─── Cached public entry points ───────────────────────────────────────────

/**
 * Fetch active SFR listings with a documented price reduction.
 * Throws on DB error — never caches poison-null. Never rejects: a read that
 * did not answer resolves to an empty list with `degraded: true`.
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
    // v4 (2026-07-08, design-audit P1): drops carry streetSuffix — evict
    // entries cached without it.
    // v5 (2026-07-12, §0): drop is prev→current price (recovered/relisted
    // listings excluded) — evict entries holding the event-new_price math.
    // v6 (2026-09-15, SITE-108, §0): the tile join below handed one key per
    // event straight to getListingTiles; past ~535 keys that read blew the
    // PostgREST URL, threw, and cached [] — so a BUSY week published
    // "Nothing in this window" while 259 homes qualified. Evict those.
    // v7 (2026-09-24, §0): single family is the 'Single Family Residence' sub
    // type (bare 'A' let condos, townhomes and manufactured homes in); the
    // event read pages past 1,000 rows; an empty tile read throws instead of
    // caching an empty week; `limit` is the only list cap; the result carries
    // `cap` and `degraded`. Evict entries built the old way.
    ['price-drops-v7', key],
    { revalidate: 1800, tags: [cacheTag.listings] },
    { drops: [], total: 0, cap: listCap(input), fetchedAt: new Date().toISOString(), degraded: true },
  )()
}

/**
 * Aggregate digest for the price-drop social producer.
 * cityOrRegion: city display name (e.g. "Bend") or "central-oregon" for region-wide.
 * days: look-back window. Default 7.
 * Throws on DB error — never caches poison-null. Never rejects: a read that
 * did not answer resolves to `count: 0` with `degraded: true`, which is not a
 * count and must not be published as one.
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
    // v4 (2026-07-08): same streetSuffix eviction as price-drops-v4.
    // v5 (2026-07-12, §0): prev→current drop math — evict event-new_price entries.
    // v6 (2026-09-24, §0): count and aggregates cover the whole window, not
    // the 60/40 list cap; the price-drops-v7 read changes; `degraded`.
    ['price-drop-digest-v6', key],
    { revalidate: 3600, tags: [cacheTag.listings] },
    {
      count: 0,
      totalReduced: 0,
      biggestDrop: null,
      medianDropPct: null,
      fetchedAt: new Date().toISOString(),
      geoLabel: cityOrRegion,
      degraded: true,
    },
  )()
}
