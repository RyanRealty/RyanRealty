/**
 * Local outcome reads — the rows behind chapter 2 of the seller document
 * ("Priced right sells. Priced high sits.") and behind the subject's own
 * final-cycle timeline in chapter 1.
 *
 * Three reads, all keyed to the SUBJECT'S CITY and a 12-month window:
 *
 *  1. `getCmaCityClosedOutcomes` — every single-family close in the city in
 *     the window, with the two asks and `days_to_pending`. Feeds the offer
 *     timing curve AND the two "sold" groups of the first-ask outcome, so the
 *     three figures a reader compares are computed off ONE population rather
 *     than three differently-filtered ones.
 *  2. `getCmaCityFailedOutcomes` — every single-family listing in the city
 *     that came off the market unsold in the window (Expired / Canceled /
 *     Withdrawn), with the dates the "did not sell" days are measured
 *     between.
 *  3. `getCmaListingPriceEvents` — the dated ask changes recorded against one
 *     ListingKey, from `price_history` (structured old → new) and
 *     `listing_history` (the MLS change log). This is what turns the subject's
 *     final cycle into a stepped line instead of two endpoints.
 *
 * WHY THE RAW TABLE AND NOT A CACHE. `market_stats_cache` and
 * `market_pulse_live` publish a single median-to-pending per geo over a
 * rolling window. Neither carries a DISTRIBUTION (the share with an offer by
 * day 7 / 14 / 30 …) and neither splits closes by whether the first ask ever
 * moved, so no cached row can answer chapter 2. The reads are therefore over
 * `listings` itself, and every one of them is (a) narrow — four to six
 * columns — (b) bounded to one city and twelve months (Bend, the largest, is
 * ~2,100 closed + ~820 failed rows), (c) paged to completion with a stable
 * order so PostgREST's 1,000-row cap cannot silently truncate a median, and
 * (d) cached for six hours, the same window `market_stats_cache` uses, keyed
 * by city + window start.
 *
 * §7: supabase-js takes mixed-case RETS column names BARE. The double-quoting
 * rule is for raw SQL only — a literal `"` inside a JS string is sent to
 * PostgREST as part of the column name and silently returns nothing.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { resolveCanonicalListingKey } from '@/lib/data/listings/resolveCanonicalListingKey'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

/** PostgREST caps a response at 1,000 rows whatever `.limit()` says (G48). */
const PAGE_SIZE = 1000
/** Guards a pathological city; a hit is disclosed, never silently truncated. */
const CEILING = 12_000

/** The single-family filter every market figure in this repo is built on. */
export const CMA_SFR_FILTER = "PropertyType='A' AND property_sub_type='Single Family Residence'"

/** Statuses that mean "came off the market without selling". */
export const CMA_FAILED_STATUSES = ['Expired', 'Canceled', 'Withdrawn'] as const

export type CmaCityClosedOutcomeRow = {
  ListingKey: string
  CloseDate: string
  /** On-market date to accepted offer, in days. Never list-to-close (§7). */
  days_to_pending: number | null
  OriginalListPrice: number | null
  ListPrice: number | null
  /** The contract price. Every share-of-ask figure divides this by an ask. */
  ClosePrice: number | null
}

export type CmaCityFailedOutcomeRow = {
  ListingKey: string
  StandardStatus: string | null
  ListDate: string | null
  OnMarketDate: string | null
  off_market_date: string | null
  status_change_timestamp: string | null
  DaysOnMarket: number | null
  OriginalListPrice: number | null
  ListPrice: number | null
}

export type CmaListingPriceEvent = {
  /** YYYY-MM-DD. */
  date: string
  /** The ask AFTER the change. */
  ask: number
  /** The ask before it, when the record carries one. */
  previousAsk: number | null
  source: 'price_history' | 'listing_history'
}

const CLOSED_COLUMNS = 'ListingKey, CloseDate, days_to_pending, OriginalListPrice, ListPrice, ClosePrice'
const FAILED_COLUMNS =
  'ListingKey, StandardStatus, ListDate, OnMarketDate, off_market_date, status_change_timestamp, DaysOnMarket, OriginalListPrice, ListPrice'

/**
 * Closed single-family sales in one city since `sinceIso`.
 *
 * THROWS on a database error rather than returning `[]` — an empty array from
 * a pooler blip, cached for six hours, is a chapter that tells the seller
 * their city had no sales. `makeResilientCached` retries once uncached and
 * only then falls back (lib/data/cache/resilient.ts).
 */
async function fetchCmaCityClosedOutcomes(
  city: string,
  sinceIso: string,
): Promise<CmaCityClosedOutcomeRow[]> {
  const sb = client()
  if (!sb || !city.trim()) return []
  const out: CmaCityClosedOutcomeRow[] = []
  for (let from = 0; from < CEILING; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('listings')
      .select(CLOSED_COLUMNS)
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .eq('StandardStatus', 'Closed')
      .gte('CloseDate', sinceIso)
      // A stable secondary key: unordered pagination drops rows across pages.
      .order('CloseDate', { ascending: true })
      .order('ListingKey', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`getCmaCityClosedOutcomes(${city}): ${error.message}`)
    out.push(...((data ?? []) as unknown as CmaCityClosedOutcomeRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return out
}

export const getCmaCityClosedOutcomes = makeResilientCached(
  fetchCmaCityClosedOutcomes,
  ['cma-city-closed-outcomes-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.listings, cacheTag.market] },
  [] as CmaCityClosedOutcomeRow[],
)

/**
 * Single-family listings in one city that came off the market unsold on or
 * after `sinceIso`.
 *
 * The window is measured on `off_market_date` — the day the listing left the
 * market — because that is the event being counted. All 7,536 Redmond and
 * 19,997 of 20,000 Bend failed rows carry it (verified 2026-09-07), and the
 * few that do not fall back to `status_change_timestamp` at compute time.
 */
async function fetchCmaCityFailedOutcomes(
  city: string,
  sinceIso: string,
): Promise<CmaCityFailedOutcomeRow[]> {
  const sb = client()
  if (!sb || !city.trim()) return []
  const out: CmaCityFailedOutcomeRow[] = []
  for (let from = 0; from < CEILING; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('listings')
      .select(FAILED_COLUMNS)
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .in('StandardStatus', CMA_FAILED_STATUSES as unknown as string[])
      .gte('off_market_date', sinceIso)
      .order('off_market_date', { ascending: true })
      .order('ListingKey', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`getCmaCityFailedOutcomes(${city}): ${error.message}`)
    out.push(...((data ?? []) as unknown as CmaCityFailedOutcomeRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return out
}

export const getCmaCityFailedOutcomes = makeResilientCached(
  fetchCmaCityFailedOutcomes,
  ['cma-city-failed-outcomes-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.listings, cacheTag.market] },
  [] as CmaCityFailedOutcomeRow[],
)

/** `2026-07-28T16:18:30.175+00:00` and `2026-07-28` both → `2026-07-28`. */
function dayOf(value: unknown): string | null {
  const s = String(value ?? '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function positive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * `ListPrice: 475000.00 → 460000.00` — the MLS change-log line the Spark sync
 * stores in `listing_history.description`. The arrow is a real U+2192 in the
 * feed; a hyphen-arrow is accepted too because older rows carry one.
 */
const LIST_PRICE_CHANGE_RE = /ListPrice:\s*([\d.,]+)\s*(?:→|->|=>)\s*([\d.,]+)/i

function parseListPriceChange(description: string | null | undefined): { from: number | null; to: number | null } | null {
  const m = LIST_PRICE_CHANGE_RE.exec(description ?? '')
  if (!m) return null
  const from = positive(Number(m[1].replace(/,/g, '')))
  const to = positive(Number(m[2].replace(/,/g, '')))
  return to == null ? null : { from, to }
}

/**
 * Every dated ask change recorded against one listing, oldest first.
 *
 * TWO WRITERS, ONE TIMELINE. The delta sync writes `price_history` (explicit
 * `old_price` → `new_price`); the Spark full-history backfill writes
 * `listing_history`, where a price move arrives as `event='FieldChange'` with
 * `description='ListPrice: 475000.00 → 460000.00'`. Recent listings often have
 * NO `listing_history` rows at all, and older ones have no `price_history`, so
 * reading one table alone loses cuts. Both are read and merged; a change
 * recorded by both is one step, not two.
 *
 * `listing_history.price_change` is a FRACTION (-0.032), not dollars — it is
 * never treated as an amount here.
 */
async function fetchCmaListingPriceEvents(listingKey: string): Promise<CmaListingPriceEvent[]> {
  const sb = client()
  if (!sb || !listingKey.trim()) return []
  // `price_history` and `listing_history` are keyed by the RETS ListingKey. The
  // builder passes one straight off a `listings` row, but this reader is
  // exported and an MLS ListNumber here would return NOTHING with no error —
  // the exact silence that has broken photos, videos and the history rail
  // before. Resolve first; the resolver is cached and returns its input
  // unchanged when the key is already canonical.
  const key = await resolveCanonicalListingKey(listingKey.trim())
  if (!key) return []

  const [priceRes, historyRes] = await Promise.all([
    sb
      .from('price_history')
      .select('old_price, new_price, changed_at')
      .eq('listing_key', key)
      .order('changed_at', { ascending: true })
      .limit(200),
    sb
      .from('listing_history')
      .select('event, event_date, price, description')
      .eq('listing_key', key)
      .order('event_date', { ascending: true })
      .limit(500),
  ])
  if (priceRes.error) throw new Error(`getCmaListingPriceEvents(price_history ${key}): ${priceRes.error.message}`)
  if (historyRes.error) throw new Error(`getCmaListingPriceEvents(listing_history ${key}): ${historyRes.error.message}`)

  const events: CmaListingPriceEvent[] = []
  for (const row of (priceRes.data ?? []) as Array<Record<string, unknown>>) {
    const date = dayOf(row.changed_at)
    const ask = positive(row.new_price)
    if (!date || ask == null) continue
    const previousAsk = positive(row.old_price)
    if (previousAsk != null && previousAsk === ask) continue
    events.push({ date, ask, previousAsk, source: 'price_history' })
  }
  for (const row of (historyRes.data ?? []) as Array<Record<string, unknown>>) {
    const date = dayOf(row.event_date)
    if (!date) continue
    const change = parseListPriceChange(row.description as string | null)
    if (!change || change.to == null) continue
    events.push({ date, ask: change.to, previousAsk: change.from, source: 'listing_history' })
  }

  // One step per (day, ask). price_history is inserted first, so its entry
  // wins the de-dupe and keeps its explicit previous ask.
  const seen = new Set<string>()
  return events
    .filter((e) => {
      const k = `${e.date}|${e.ask}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const getCmaListingPriceEvents = makeResilientCached(
  fetchCmaListingPriceEvents,
  ['cma-listing-price-events-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.listings] },
  [] as CmaListingPriceEvent[],
)

/**
 * ── the failed-then-sold pair reads ────────────────────────────────────────
 *
 * Two more narrow reads over the same table, on a LONGER window (24 months of
 * failures) and carrying the street fields, because the pairing is done on the
 * address: a cycle that ended unsold, then a closed sale at the same house.
 * `lib/pricing/failed-then-sold.ts` holds the pairing rules — the same rules
 * `scripts/cma-backtest.mjs` calibrated the regional figure with.
 *
 * The closed side cannot reuse `getCmaCityClosedOutcomes`: that read is the
 * 12-month outcome population and carries no address, and a failure 23 months
 * old can be answered by a sale 5 months old, so both sides run over the same
 * 24-month window.
 */
export type CmaCityFailedCycleRow = {
  ListingKey: string
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  StandardStatus: string | null
  ListPrice: number | null
  OriginalListPrice: number | null
  off_market_date: string | null
  status_change_timestamp: string | null
}

export type CmaCityClosedSaleRow = {
  ListingKey: string
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  ClosePrice: number | null
  CloseDate: string | null
  ListDate: string | null
}

const FAILED_CYCLE_COLUMNS =
  'ListingKey, StreetNumber, StreetName, City, StandardStatus, ListPrice, OriginalListPrice, off_market_date, status_change_timestamp'
const CLOSED_SALE_COLUMNS = 'ListingKey, StreetNumber, StreetName, City, ClosePrice, CloseDate, ListDate'

async function fetchCmaCityFailedCycles(
  city: string,
  sinceIso: string,
): Promise<CmaCityFailedCycleRow[]> {
  const sb = client()
  if (!sb || !city.trim()) return []
  const out: CmaCityFailedCycleRow[] = []
  for (let from = 0; from < CEILING; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('listings')
      .select(FAILED_CYCLE_COLUMNS)
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .in('StandardStatus', CMA_FAILED_STATUSES as unknown as string[])
      .gte('off_market_date', sinceIso)
      .order('off_market_date', { ascending: true })
      .order('ListingKey', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`getCmaCityFailedCycles(${city}): ${error.message}`)
    out.push(...((data ?? []) as unknown as CmaCityFailedCycleRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return out
}

export const getCmaCityFailedCycles = makeResilientCached(
  fetchCmaCityFailedCycles,
  ['cma-city-failed-cycles-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.listings, cacheTag.market] },
  [] as CmaCityFailedCycleRow[],
)

async function fetchCmaCityClosedSales(city: string, sinceIso: string): Promise<CmaCityClosedSaleRow[]> {
  const sb = client()
  if (!sb || !city.trim()) return []
  const out: CmaCityClosedSaleRow[] = []
  for (let from = 0; from < CEILING; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from('listings')
      .select(CLOSED_SALE_COLUMNS)
      .eq('City', city)
      .eq('PropertyType', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .eq('StandardStatus', 'Closed')
      .gte('CloseDate', sinceIso)
      .order('CloseDate', { ascending: true })
      .order('ListingKey', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`getCmaCityClosedSales(${city}): ${error.message}`)
    out.push(...((data ?? []) as unknown as CmaCityClosedSaleRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return out
}

export const getCmaCityClosedSales = makeResilientCached(
  fetchCmaCityClosedSales,
  ['cma-city-closed-sales-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.listings, cacheTag.market] },
  [] as CmaCityClosedSaleRow[],
)

/** Exported for the compute layer's test fixtures and for the source blocks. */
export const CMA_LOCAL_OUTCOME_READS = {
  closedColumns: CLOSED_COLUMNS,
  failedColumns: FAILED_COLUMNS,
  failedCycleColumns: FAILED_CYCLE_COLUMNS,
  closedSaleColumns: CLOSED_SALE_COLUMNS,
  pageSize: PAGE_SIZE,
  ceiling: CEILING,
} as const
