'use server'

import { unstable_cache } from 'next/cache'
import { getListingTiles } from '@/lib/data'
// Imported from its module rather than the '@/lib/data' barrel on purpose: that
// barrel is frozen by the ci:file-size-budget ratchet (audit p2.2), which may
// only shrink. app/page.tsx and app/sitemap.ts read DAL submodules the same way.
import {
  getWentPendingInWindow,
  type WentPendingListing,
} from '@/lib/data/listings/getWentPendingInWindow'
import {
  SALES_PERIODS,
  getDateRangeForPeriod,
  getPeriodLabel,
  type SalesPeriodSlug,
} from '@/lib/sales-report-periods'
import { getPropertyTypeSegmentKey } from '@/lib/property-type'
import { scopeReportCities } from '@/lib/market/report-scope'

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Market report baseline:
 * - include residential + condo/town
 * - exclude land/vacant land/lot inventory
 * - exclude mobile/manufactured homes
 */
function isIndustryStandardReportPropertyType(propertyType: string | null | undefined): boolean {
  const raw = (propertyType ?? '').trim()
  if (!raw) return true
  const segment = getPropertyTypeSegmentKey(raw)
  if (segment === 'acreage' || segment === 'manufactured') return false
  const lower = raw.toLowerCase()
  if (lower.includes('vacant')) return false
  if (lower.includes('lot')) return false
  if (lower.includes('mobile')) return false
  return true
}

function isValidEventDate(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim()
  if (!raw) return false
  return !Number.isNaN(new Date(raw).getTime())
}

export type ReportListing = {
  listing_key: string
  event: string
  event_date: string | null
  city: string | null
  price: number | null
  description: string | null
  property_type: string | null
  /** Days on market (CloseDate − ListDate); only for closed from listings table. */
  days_on_market: number | null
  /** Primary photo URL (closed listings from listings table only). */
  photo_url: string | null
}

export type MarketReportByCity = {
  city: string
  pending: ReportListing[]
  closed: ReportListing[]
}

type ListingRow = {
  ListingKey?: string | null
  ListNumber?: string | null
  City?: string | null
  CloseDate?: string | null
  ListDate?: string | null
  ListPrice?: number | null
  ClosePrice?: number | null
  details?: { ClosePrice?: number | string | null } | null
  PropertyType?: string | null
  StreetNumber?: string | null
  StreetName?: string | null
  SubdivisionName?: string | null
  PhotoURL?: string | null
}

function daysBetween(closeDate: string | null | undefined, listDate: string | null | undefined): number | null {
  if (!closeDate || !listDate) return null
  const c = new Date(closeDate).getTime()
  const l = new Date(listDate).getTime()
  if (Number.isNaN(c) || Number.isNaN(l) || l >= c) return null
  return Math.round((c - l) / (24 * 60 * 60 * 1000))
}

/** Build one ReportListing from a closed listing row (listings table). */
function closedListingToReportListing(r: ListingRow): ReportListing {
  const key = (r.ListingKey ?? r.ListNumber ?? '').toString().trim() || 'unknown'
  const parts = [r.StreetNumber, r.StreetName].filter(Boolean).map((x) => (x ?? '').toString().trim())
  const description = parts.length ? parts.join(' ') : null
  const closePriceFromDetails = r.details?.ClosePrice
  const normalizedCloseFromDetails =
    typeof closePriceFromDetails === 'number'
      ? closePriceFromDetails
      : typeof closePriceFromDetails === 'string'
        ? Number(closePriceFromDetails)
        : null
  const normalizedClosePrice =
    typeof r.ClosePrice === 'number' && Number.isFinite(r.ClosePrice)
      ? r.ClosePrice
      : normalizedCloseFromDetails != null && Number.isFinite(normalizedCloseFromDetails)
        ? normalizedCloseFromDetails
        : typeof r.ListPrice === 'number' && Number.isFinite(r.ListPrice)
          ? r.ListPrice
          : null
  return {
    listing_key: key,
    event: 'Closed',
    event_date: r.CloseDate ?? null,
    city: (r.City ?? '').trim() || null,
    price: normalizedClosePrice,
    description,
    property_type: (r.PropertyType ?? '').trim() || null,
    days_on_market: daysBetween(r.CloseDate, r.ListDate),
    photo_url: (r.PhotoURL ?? '').trim() || null,
  }
}

/**
 * Fetch closed sales from the listings table (CloseDate + StandardStatus).
 * This is the same source as report RPCs and works as long as Spark sync populates CloseDate.
 * Returns data grouped by city.
 */
async function getClosedSalesFromListings(
  periodStart: Date,
  periodEnd: Date
): Promise<MarketReportByCity[]> {
  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)
  // DAL: closed-sales window via listing_tile_mv close_date range. DOM
  // comes from the MV's `dom` column instead of computing CloseDate − ListDate.
  const tiles = await getListingTiles({
    status: 'closed',
    closedFromDate: `${startStr}T00:00:00.000Z`,
    closedToDate: `${endStr}T23:59:59.999Z`,
    sort: 'close-newest',
    limit: 5000,
  })
  const list: ListingRow[] = tiles.map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber ?? undefined,
    City: t.city ?? undefined,
    CloseDate: t.closeDate ?? undefined,
    ListDate: t.onMarketDate ?? undefined,
    ListPrice: t.listPrice ?? undefined,
    ClosePrice: t.closePrice ?? undefined,
    PropertyType: t.propertyType ?? undefined,
    StreetNumber: t.streetNumber ?? undefined,
    StreetName: t.streetName ?? undefined,
    SubdivisionName: t.subdivisionName ?? undefined,
    PhotoURL: t.photoUrl ?? undefined,
    _domFromMv: t.dom ?? undefined,
  })) as ListingRow[]
  if (list.length === 0) return []

  const byCity = new Map<string, ReportListing[]>()
  for (const r of list) {
    if (!isIndustryStandardReportPropertyType(r.PropertyType)) continue
    if (!isValidEventDate(r.CloseDate)) continue
    const city = (r.City ?? '').trim() || 'Other'
    if (!byCity.has(city)) byCity.set(city, [])
    byCity.get(city)!.push(closedListingToReportListing(r))
  }
  const cities = [...byCity.keys()].filter((c) => c !== 'Other').sort((a, b) => a.localeCompare(b))
  if (byCity.has('Other')) cities.push('Other')
  return cities.map((city) => ({
    city,
    pending: [],
    closed: (byCity.get(city) ?? []).sort((a, b) =>
      (b.event_date ?? '').localeCompare(a.event_date ?? '')
    ),
  }))
}

/** Build one ReportListing from a listing that went pending in the window. */
function wentPendingToReportListing(row: WentPendingListing): ReportListing {
  return {
    listing_key: row.listingKey,
    event: 'Pending',
    event_date: row.pendingAt,
    city: row.city,
    price: row.listPrice,
    description: row.streetLine,
    property_type: row.propertyType,
    days_on_market: null,
    photo_url: null,
  }
}

/**
 * Listings that went pending in the date range, grouped by city.
 *
 * Source: `activity_events`, `event_type = 'status_pending'`, via the DAL. The
 * previous source — `listing_history` filtered `event ILIKE '%Pending%'` — was
 * dead: that column carries no Pending value in any window (verified live
 * 2026-08-19: 0 matching rows out of 3,900,150; the vocabulary is FieldChange,
 * NewListing, BackOnMarket, …), so it returned [] every time and every
 * published report showed zero pendings while the page copy promised them.
 * `listings.pending_timestamp` is the more precise column but is unindexed and
 * does not answer for the anon role the public page reads with. See
 * lib/data/listings/getWentPendingInWindow.ts for the full trace.
 */
async function getPendingFromListings(
  periodStart: Date,
  periodEnd: Date
): Promise<MarketReportByCity[]> {
  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)
  const rows = await getWentPendingInWindow({
    fromIso: `${startStr}T00:00:00.000Z`,
    toIso: `${endStr}T23:59:59.999Z`,
  })
  if (rows.length === 0) return []

  const byCity = new Map<string, ReportListing[]>()
  for (const row of rows) {
    if (!isIndustryStandardReportPropertyType(row.propertyType)) continue
    if (!isValidEventDate(row.pendingAt)) continue
    const city = (row.city ?? '').trim() || 'Other'
    if (!byCity.has(city)) byCity.set(city, [])
    byCity.get(city)!.push(wentPendingToReportListing(row))
  }
  const cities = [...byCity.keys()].filter((c) => c !== 'Other').sort((a, b) => a.localeCompare(b))
  if (byCity.has('Other')) cities.push('Other')
  return cities.map((city) => ({
    city,
    pending: (byCity.get(city) ?? []).sort((a, b) =>
      (b.event_date ?? '').localeCompare(a.event_date ?? '')
    ),
    closed: [],
  }))
}

/**
 * Market report data by city for a date window: closed sales from
 * `listing_tile_mv` (close_date), pending from `activity_events`
 * (`status_pending`), both through the DAL.
 *
 * SCOPE (§0, 2026-08-19). The result is filtered to the Central Oregon
 * service area before it is returned, because every consumer of this function
 * publishes it under a Central Oregon claim. The MLS feed and
 * `listing_tile_mv` are statewide (76,925 Medford rows, 40,851 Grants Pass,
 * 34,304 Klamath Falls, verified live), and `getListingTiles` applies its own
 * allowlist only when the caller passes no geographic predicate — an
 * incidental filter, not a scope. Seven published reports carried Southern
 * Oregon and Willamette Valley cities under "Here's what happened in the
 * Central Oregon real estate market last week, by city"; weekly-2026-05-24
 * put 26 out-of-area cities and roughly half of its 274 closings under that
 * sentence. The filter is `scopeReportCities` — one geography, from
 * lib/central-oregon.ts.
 */
export async function getMarketReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<MarketReportByCity[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const [closedByCity, pendingByCity] = await Promise.all([
    getClosedSalesFromListings(periodStart, periodEnd),
    getPendingFromListings(periodStart, periodEnd),
  ])
  const citySet = new Set<string>([
    ...closedByCity.map((c) => c.city),
    ...pendingByCity.map((c) => c.city),
  ])
  const cities = [...citySet].sort((a, b) => a.localeCompare(b))
  const merged = cities.map((city) => {
    const closed = closedByCity.find((c) => c.city === city)?.closed ?? []
    const pending = pendingByCity.find((c) => c.city === city)?.pending ?? []
    return { city, pending, closed }
  })
  // The 'Other' bucket (blank `City`) drops out here too: a section nobody can
  // attribute cannot be shown to be in area.
  return scopeReportCities(merged)
}

/**
 * Closed sales for one city (and optional subdivision) from the listings table.
 * Same source as report RPCs (CloseDate + StandardStatus).
 */
async function getClosedSalesForLocation(
  city: string,
  periodStart: Date,
  periodEnd: Date,
  subdivision?: string | null
): Promise<ReportListing[]> {
  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)
  // DAL: closed-sales for a city (and optional subdivision) via listing_tile_mv.
  const tiles = await getListingTiles({
    city: city.trim() || undefined,
    subdivision: subdivision?.trim() || undefined,
    status: 'closed',
    closedFromDate: `${startStr}T00:00:00.000Z`,
    closedToDate: `${endStr}T23:59:59.999Z`,
    sort: 'close-newest',
    limit: 5000,
  })
  const list: ListingRow[] = tiles.map((t) => ({
    ListingKey: t.listingKey,
    ListNumber: t.listNumber ?? undefined,
    City: t.city ?? undefined,
    CloseDate: t.closeDate ?? undefined,
    ListDate: t.onMarketDate ?? undefined,
    ListPrice: t.listPrice ?? undefined,
    ClosePrice: t.closePrice ?? undefined,
    PropertyType: t.propertyType ?? undefined,
    StreetNumber: t.streetNumber ?? undefined,
    StreetName: t.streetName ?? undefined,
    SubdivisionName: t.subdivisionName ?? undefined,
  })) as ListingRow[]
  return list
    .filter((row) => isIndustryStandardReportPropertyType(row.PropertyType))
    .filter((row) => isValidEventDate(row.CloseDate))
    .map(closedListingToReportListing)
    .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))
}

/**
 * Pending and closed listing events for a single location and custom date range.
 * Closed from `listing_tile_mv` (close_date); pending from `activity_events`
 * (`status_pending`). Both sides take the caller's city (and optional
 * subdivision) as their geography — the caller has named it, so the
 * service-area allowlist does not apply here.
 */
export async function getMarketReportDataForLocation(
  city: string,
  periodStart: Date,
  periodEnd: Date,
  subdivision?: string | null
): Promise<{ pending: ReportListing[]; closed: ReportListing[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return { pending: [], closed: [] }

  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)

  const [closed, pendingRows] = await Promise.all([
    getClosedSalesForLocation(city, periodStart, periodEnd, subdivision),
    getWentPendingInWindow({
      fromIso: `${startStr}T00:00:00.000Z`,
      toIso: `${endStr}T23:59:59.999Z`,
      city: city.trim() || null,
      subdivision: subdivision?.trim() || null,
    }),
  ])

  const pending = pendingRows
    .filter((row) => isIndustryStandardReportPropertyType(row.propertyType))
    .filter((row) => isValidEventDate(row.pendingAt))
    .map(wentPendingToReportListing)
    .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))
  return { pending, closed }
}

export type SalesReportCardData = {
  city: string
  period: SalesPeriodSlug
  periodLabel: string
  periodSlug: SalesPeriodSlug
  start: Date
  end: Date
  closedCount: number
  pendingCount: number
  medianClosedPrice: number | null
  startStr: string
  endStr: string
  /** First closed listing's photo for tile background (homes in this report). */
  featuredImageUrl: string | null
  /** Listing keys in this report (for aggregated engagement: likes, saves, shares). */
  listingKeys: string[]
  /** Aggregated engagement across listings in this report (set by reports page). */
  likeCount?: number
  saveCount?: number
  shareCount?: number
}

/**
 * Inner fetch for getSalesReportCardsData — separated so unstable_cache can wrap it.
 * Throws on missing config so a transient error is never cached as an empty result.
 */
async function _fetchSalesReportCardsData(
  cityList: string[],
  dateKey: string,
): Promise<SalesReportCardData[]> {
  void dateKey // included in unstable_cache key only; no runtime use
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')

  const cards: SalesReportCardData[] = []
  for (const period of SALES_PERIODS) {
    const { start, end } = getDateRangeForPeriod(period)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)
    const byCity = await getMarketReportData(start, end)
    const byCityMap = new Map(byCity.map((c) => [c.city, c]))
    for (const city of cityList) {
      const data = byCityMap.get(city) ?? { city, pending: [], closed: [] }
      const closedList = data.closed
      const pendingList = data.pending
      const prices = closedList.map((c) => c.price).filter((p): p is number => p != null && Number.isFinite(p))
      const listingKeys = closedList.map((c) => c.listing_key).filter(Boolean)
      const featuredImageUrl = closedList.find((c) => (c.photo_url ?? '').trim())?.photo_url?.trim() ?? null
      cards.push({
        city,
        period,
        periodLabel: getPeriodLabel(period),
        periodSlug: period,
        start,
        end,
        closedCount: closedList.length,
        pendingCount: pendingList.length,
        medianClosedPrice: median(prices),
        startStr,
        endStr,
        featuredImageUrl,
        listingKeys,
      })
    }
  }
  return cards
}

// v3 key (2026-08-19): every cached card carries pendingCount 0, because the
// pending path read a listing_history event value that does not exist. The
// data cache survives deploys, so without the bump the dead-source zeros keep
// serving for a full revalidate window after the live source lands — the same
// reason market-report-by-slug went to v2.
// v2 forced out the "No sales this period" entries cached while
// listing_tile_mv sat 8 days stale (2026-07 incident).
const _getSalesReportCardsDataCached = unstable_cache(
  _fetchSalesReportCardsData,
  ['sales-report-cards-v3'],
  { revalidate: 3600, tags: ['market-reports'] },
)

/**
 * Pre-populated sales report cards: for each city and each period (this week, last week, last month, last year),
 * returns summary data so the reports index can show cards without waiting for weekly generation.
 * Cached 3600s; keyed by city list and current UTC date so each calendar day gets fresh period windows.
 */
export async function getSalesReportCardsData(cities: readonly string[]): Promise<SalesReportCardData[]> {
  const cityList = [...new Set(cities.map((c) => c.trim()).filter(Boolean))]
  if (cityList.length === 0) return []
  // Include today's UTC date in the key so the 7-day/monthly windows stay aligned.
  const dateKey = new Date().toISOString().slice(0, 10)
  try {
    return await _getSalesReportCardsDataCached(cityList, dateKey)
  } catch (err) {
    // Loud, not silent: an [] here renders a wall of "No sales this period"
    // cards that reads as real market data (the 2026-07 stale-MV incident hid
    // for 8 days behind exactly this). The page still degrades gracefully, but
    // the failure lands in the function logs.
    console.error('[market-reports] getSalesReportCardsData failed:', err)
    return []
  }
}

// getMarketReportBySlug / getReportImageUrl / listMarketReports were DELETED
// here 2026-08-19. They were uncached duplicates of the DAL readers in
// lib/data/market/getMarketReports.ts (the canonical ones every page already
// imports from '@/lib/data'), left behind when the read paths moved. Keeping a
// second getMarketReportBySlug that returns raw `content_html` would be a way
// around the report's geographic scope, which is applied in the DAL reader.
// Read a report through '@/lib/data'.
