'use server'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  SALES_PERIODS,
  getDateRangeForPeriod,
  getPeriodLabel,
  type SalesPeriodSlug,
} from '@/lib/sales-report-periods'

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
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
  return {
    listing_key: key,
    event: 'Closed',
    event_date: r.CloseDate ?? null,
    city: (r.City ?? '').trim() || null,
    price: typeof r.ListPrice === 'number' && Number.isFinite(r.ListPrice) ? r.ListPrice : null,
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
  supabase: SupabaseClient,
  periodStart: Date,
  periodEnd: Date
): Promise<MarketReportByCity[]> {
  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)
  const { data: rows } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, City, CloseDate, ListDate, ListPrice, PropertyType, StreetNumber, StreetName, SubdivisionName, PhotoURL')
    .ilike('StandardStatus', '%closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', `${startStr}T00:00:00.000Z`)
    .lte('CloseDate', `${endStr}T23:59:59.999Z`)

  const list = (rows ?? []) as ListingRow[]
  if (list.length === 0) return []

  const byCity = new Map<string, ReportListing[]>()
  for (const r of list) {
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
      (a.event_date ?? '').localeCompare(b.event_date ?? '')
    ),
  }))
}

/**
 * Fetch pending events from listing_history for the date range, then attach city from listings (match by ListingKey or ListNumber).
 */
async function getPendingFromHistory(
  supabase: SupabaseClient,
  periodStart: Date,
  periodEnd: Date
): Promise<MarketReportByCity[]> {
  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)
  const { data: historyRows } = await supabase
    .from('listing_history')
    .select('listing_key, event, event_date, price, description')
    .gte('event_date', `${startStr}T00:00:00.000Z`)
    .lte('event_date', `${endStr}T23:59:59.999Z`)
    .ilike('event', '%Pending%')

  const rows = (historyRows ?? []) as Array<{ listing_key: string; event: string; event_date: string | null; price: number | null; description: string | null }>
  if (rows.length === 0) return []

  const keys = [...new Set(rows.map((r) => r.listing_key).filter(Boolean))]
  const { data: byListingKey } = await supabase.from('listings').select('ListingKey, ListNumber, City, PropertyType').in('ListingKey', keys)
  const { data: byListNumber } = await supabase.from('listings').select('ListingKey, ListNumber, City, PropertyType').in('ListNumber', keys)
  const keyToCity = new Map<string, string>()
  const keyToPropertyType = new Map<string, string | null>()
  for (const L of [...(byListingKey ?? []), ...(byListNumber ?? [])]) {
    const r = L as { ListingKey?: string; ListNumber?: string; City?: string; PropertyType?: string | null }
    const city = (r.City ?? '').trim()
    const pt = r.PropertyType?.trim() || null
    if (r.ListingKey) {
      keyToCity.set(r.ListingKey, city)
      keyToPropertyType.set(r.ListingKey, pt)
    }
    if (r.ListNumber) {
      keyToCity.set(r.ListNumber, city)
      keyToPropertyType.set(r.ListNumber, pt)
    }
  }
  const byCity = new Map<string, ReportListing[]>()
  for (const row of rows) {
    const city = keyToCity.get(row.listing_key) ?? 'Other'
    if (!byCity.has(city)) byCity.set(city, [])
    byCity.get(city)!.push({
      listing_key: row.listing_key,
      event: row.event,
      event_date: row.event_date,
      city: city === 'Other' ? null : city,
      price: row.price,
      description: row.description,
      property_type: keyToPropertyType.get(row.listing_key) ?? null,
      days_on_market: null,
      photo_url: null,
    })
  }
  const cities = [...byCity.keys()].filter((c) => c !== 'Other').sort((a, b) => a.localeCompare(b))
  if (byCity.has('Other')) cities.push('Other')
  return cities.map((city) => ({
    city,
    pending: (byCity.get(city) ?? []).sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? '')),
    closed: [],
  }))
}

/**
 * Fetch market report data by city: closed sales from listings table (CloseDate), pending from listing_history.
 * Uses the same listings table source as report RPCs so reports show data when Spark sync populates CloseDate.
 */
export async function getMarketReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<MarketReportByCity[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const supabase = createClient(url, anonKey)
  const [closedByCity, pendingByCity] = await Promise.all([
    getClosedSalesFromListings(supabase, periodStart, periodEnd),
    getPendingFromHistory(supabase, periodStart, periodEnd),
  ])
  const citySet = new Set<string>([
    ...closedByCity.map((c) => c.city),
    ...pendingByCity.map((c) => c.city),
  ])
  const cities = [...citySet].filter((c) => c !== 'Other').sort((a, b) => a.localeCompare(b))
  if (citySet.has('Other')) cities.push('Other')
  return cities.map((city) => {
    const closed = closedByCity.find((c) => c.city === city)?.closed ?? []
    const pending = pendingByCity.find((c) => c.city === city)?.pending ?? []
    return { city, pending, closed }
  })
}

/**
 * Closed sales for one city (and optional subdivision) from the listings table.
 * Same source as report RPCs (CloseDate + StandardStatus).
 */
async function getClosedSalesForLocation(
  supabase: SupabaseClient,
  city: string,
  periodStart: Date,
  periodEnd: Date,
  subdivision?: string | null
): Promise<ReportListing[]> {
  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)
  let q = supabase
    .from('listings')
    .select('ListingKey, ListNumber, City, CloseDate, ListDate, ListPrice, PropertyType, StreetNumber, StreetName, SubdivisionName')
    .ilike('StandardStatus', '%closed%')
    .not('CloseDate', 'is', null)
    .gte('CloseDate', `${startStr}T00:00:00.000Z`)
    .lte('CloseDate', `${endStr}T23:59:59.999Z`)
  const cityTrim = city.trim()
  if (cityTrim) q = q.ilike('City', cityTrim)
  if (subdivision?.trim()) q = q.ilike('SubdivisionName', subdivision.trim())
  const { data: rows } = await q
  const list = (rows ?? []) as ListingRow[]
  return list.map(closedListingToReportListing).sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
}

/**
 * Pending and closed listing events for a single location and custom date range.
 * Closed from listings table (CloseDate); pending from listing_history (matched by ListingKey or ListNumber).
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

  const supabase = createClient(url, anonKey)
  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)

  const [closed, pendingRows] = await Promise.all([
    getClosedSalesForLocation(supabase, city, periodStart, periodEnd, subdivision),
    (async () => {
      const { data } = await supabase
        .from('listing_history')
        .select('listing_key, event, event_date, price, description')
        .gte('event_date', `${startStr}T00:00:00.000Z`)
        .lte('event_date', `${endStr}T23:59:59.999Z`)
        .ilike('event', '%Pending%')
      return (data ?? []) as Array<{ listing_key: string; event: string; event_date: string | null; price: number | null; description: string | null }>
    })(),
  ])

  if (pendingRows.length === 0) return { pending: [], closed }

  const keys = [...new Set(pendingRows.map((r) => r.listing_key).filter(Boolean))]
  const { data: byListingKey } = await supabase.from('listings').select('ListingKey, ListNumber, City, SubdivisionName, PropertyType').in('ListingKey', keys)
  const { data: byListNumber } = await supabase.from('listings').select('ListingKey, ListNumber, City, SubdivisionName, PropertyType').in('ListNumber', keys)
  const cityTrim = city.trim().toLowerCase()
  const subdivTrim = subdivision?.trim()?.toLowerCase() ?? null
  const keyToMatch = new Map<string, boolean>()
  const keyToPropertyType = new Map<string, string | null>()
  for (const L of [...(byListingKey ?? []), ...(byListNumber ?? [])]) {
    const r = L as { ListingKey?: string; ListNumber?: string; City?: string; SubdivisionName?: string; PropertyType?: string | null }
    const listCity = (r.City ?? '').trim().toLowerCase()
    const listSub = (r.SubdivisionName ?? '').trim().toLowerCase()
    const match = listCity === cityTrim && (subdivTrim == null || listSub === subdivTrim)
    const pt = r.PropertyType?.trim() || null
    if (r.ListingKey) {
      keyToMatch.set(r.ListingKey, match)
      keyToPropertyType.set(r.ListingKey, pt)
    }
    if (r.ListNumber) {
      keyToMatch.set(r.ListNumber, match)
      keyToPropertyType.set(r.ListNumber, pt)
    }
  }
  const pending: ReportListing[] = []
  for (const row of pendingRows) {
    if (!keyToMatch.get(row.listing_key)) continue
    pending.push({
      listing_key: row.listing_key,
      event: row.event,
      event_date: row.event_date,
      city: city.trim(),
      price: row.price,
      description: row.description,
      property_type: keyToPropertyType.get(row.listing_key) ?? null,
      days_on_market: null,
      photo_url: null,
    })
  }
  pending.sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
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
 * Pre-populated sales report cards: for each city and each period (this week, last week, last month, last year),
 * returns summary data so the reports index can show cards without waiting for weekly generation.
 */
export async function getSalesReportCardsData(cities: string[]): Promise<SalesReportCardData[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const cityList = [...new Set(cities.map((c) => c.trim()).filter(Boolean))]
  if (cityList.length === 0) return []

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

/**
 * Get the latest report by slug (for display).
 */
export async function getMarketReportBySlug(slug: string): Promise<{
  slug: string
  period_type: string
  period_start: string
  period_end: string
  title: string
  image_storage_path: string | null
  content_html: string | null
  created_at: string
} | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null
  const supabase = createClient(url, anonKey)
  const { data } = await supabase.from('market_reports').select('*').eq('slug', slug).maybeSingle()
  return data as typeof data & { period_start: string; period_end: string } | null
}

/** Public URL for a report image (storage path in banners bucket). */
export async function getReportImageUrl(imageStoragePath: string | null): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url?.trim() || !imageStoragePath?.trim()) return null
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/banners/${imageStoragePath}`
}

/**
 * List recent reports for index/archive.
 */
export async function listMarketReports(limit = 20): Promise<Array<{ slug: string; title: string; period_start: string; period_end: string; created_at: string }>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []
  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('market_reports')
    .select('slug, title, period_start, period_end, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as Array<{ slug: string; title: string; period_start: string; period_end: string; created_at: string }>
}
