'use server'

import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import {
  getListingsForHomeTiles,
  getHomeTileRowsByKeys,
  getHotCommunitiesInCity,
} from '@/app/actions/listings'
import { HOME_TILE_SELECT } from '@/lib/listing-tile-projections'
import { getLiveMarketPulse } from '@/app/actions/market-stats'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import {
  getReportMetrics,
  getReportMetricsTimeSeries,
  type ReportMetricsTimeSeriesPoint,
} from '@/app/actions/reports'
import { slugify } from '@/lib/slug'
import { getTrendingListingKeys } from '@/app/actions/listing-views'
import { sendEvent } from '@/lib/followupboss'
import type { HomeTileRow } from '@/app/actions/listings'
import type { HotCommunity } from '@/app/actions/listings'
import type { CityMarketStats } from '@/app/actions/listings'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function supabase() {
  if (!url?.trim() || !anonKey?.trim()) throw new Error('Supabase not configured')
  return createClient(url, anonKey)
}

const ACTIVE_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'
const CLOSED_OR = 'StandardStatus.ilike.%Closed%'

/** Featured: top 6 by engagement view_count (optional city filter), then by ModificationTimestamp. Active only. */
async function _getFeaturedListingsUncached(city?: string): Promise<HomeTileRow[]> {
  try {
    const sb = supabase()
    const { data: em } = await sb
      .from('engagement_metrics')
      .select('listing_key, view_count')
      .order('view_count', { ascending: false })
      .limit(20)
    const keys = (em ?? []).map((r: { listing_key?: string }) => (r?.listing_key ?? '').trim()).filter(Boolean)
    let rows: HomeTileRow[]
    if (keys.length === 0) {
      let query = sb.from('listings').select('ListingKey').or(ACTIVE_OR).order('ModificationTimestamp', { ascending: false, nullsFirst: false }).limit(12)
      if (city?.trim()) query = query.ilike('City', city.trim())
      const { data: fallback } = await query
      const fallbackKeys = (fallback ?? []).map((r: { ListingKey?: string }) => (r?.ListingKey ?? '').trim()).filter(Boolean)
      rows = await getHomeTileRowsByKeys(fallbackKeys)
    } else {
      rows = await getHomeTileRowsByKeys(keys)
    }
    const active = rows.filter((r) => /active|for sale|coming soon/i.test(String(r.StandardStatus ?? '')))
    const filtered = city?.trim() ? active.filter((r) => (r.City ?? '').toString().trim().toLowerCase() === city.trim().toLowerCase()) : active
    if (filtered.length >= 6) return filtered.slice(0, 6)
    const fill = await getListingsForHomeTiles({ city: city?.trim() ?? 'Bend', limit: 6 - filtered.length })
    const haveKeys = new Set(filtered.map((r) => (r.ListingKey ?? r.ListNumber ?? '').toString().trim()).filter(Boolean))
    const extra = fill.filter((r) => !haveKeys.has((r.ListingKey ?? r.ListNumber ?? '').toString().trim()))
    return [...filtered, ...extra].slice(0, 6)
  } catch {
    return []
  }
}

export const getFeaturedListings = unstable_cache(
  _getFeaturedListingsUncached,
  ['featured-listings'],
  { revalidate: 300, tags: ['featured-listings'] }
)

/** Just listed: 8 newest Active by OnMarketDate (or ModificationTimestamp fallback) for the given city. */
async function _getJustListedUncached(city: string = 'Bend'): Promise<HomeTileRow[]> {
  const cityName = city.trim() || 'Bend'
  try {
    const sb = supabase()
    const query = sb
      .from('listings')
      .select(HOME_TILE_SELECT)
      .or(ACTIVE_OR)
      .eq('City', cityName)
      .order('OnMarketDate', { ascending: false, nullsFirst: false })
      .limit(32)
    const { data } = await query
    const rows = (data ?? []) as HomeTileRow[]
    const active = rows.filter((r) => /active|for sale|coming soon|pending/i.test(String(r.StandardStatus ?? '')))
    // If OnMarketDate is missing or unreliable, fall back to existing helper.
    if (active.length === 0) {
      const fallback = await getListingsForHomeTiles({ city: cityName, limit: 8 })
      return fallback.slice(0, 8)
    }
    return active.slice(0, 8)
  } catch {
    try {
      const fallback = await getListingsForHomeTiles({ city: cityName, limit: 8 })
      return fallback.slice(0, 8)
    } catch {
      return []
    }
  }
}

export const getJustListed = unstable_cache(
  _getJustListedUncached,
  ['just-listed'],
  { revalidate: 120, tags: ['just-listed'] }
)

/** Recently sold: 4 newest Closed with close price/date, optional city filter. */
async function _getRecentlySoldUncached(city?: string): Promise<(HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null })[]> {
  try {
    const sb = supabase()
    let query = sb
      .from('listings')
      .select(`${HOME_TILE_SELECT}, ClosePrice`)
      .or(CLOSED_OR)
      .not('CloseDate', 'is', null)
      .order('CloseDate', { ascending: false, nullsFirst: false })
      .limit(4)
    if (city?.trim()) query = query.ilike('City', city.trim())
    const { data } = await query
    return (data ?? []) as (HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null })[]
  } catch {
    try {
      const sb = supabase()
      let query = sb
        .from('listings')
        .select(`${HOME_TILE_SELECT}, close_price`)
        .or(CLOSED_OR)
        .not('close_date', 'is', null)
        .order('close_date', { ascending: false, nullsFirst: false })
        .limit(4)
      if (city?.trim()) query = query.ilike('City', city.trim())
      const { data } = await query
      const rows = (data ?? []) as (HomeTileRow & { close_price?: number | null; close_date?: string | null })[]
      return rows.map((r) => ({
        ...r,
        ClosePrice: (r as { close_price?: number }).close_price,
        CloseDate: (r as { close_date?: string }).close_date,
      }))
    } catch {
      return []
    }
  }
}

export const getRecentlySold = unstable_cache(
  _getRecentlySoldUncached,
  ['recently-sold'],
  { revalidate: 120, tags: ['recently-sold'] }
)

/** Price drops: 6 listings where original price > current price (from listings table), optional city filter. */
export async function getPriceDrops(city?: string): Promise<(HomeTileRow & { originalPrice?: number; savings?: number })[]> {
  try {
    const sb = supabase()
    let query = sb
      .from('listings')
      .select(`${HOME_TILE_SELECT}, OriginalListPrice`)
      .or(ACTIVE_OR)
      .not('ListPrice', 'is', null)
      .limit(300)
    if (city?.trim()) query = query.ilike('City', city.trim())
    const { data } = await query
    const rows = (data ?? []) as (HomeTileRow & { OriginalListPrice?: number | null })[]
    const withDrop = rows.filter(
      (r) => r.OriginalListPrice != null && r.ListPrice != null && r.OriginalListPrice > r.ListPrice
    )
    return withDrop.slice(0, 6).map((r) => ({
      ...r,
      originalPrice: r.OriginalListPrice ?? undefined,
      savings: r.OriginalListPrice != null && r.ListPrice != null ? r.OriginalListPrice - r.ListPrice : undefined,
    }))
  } catch {
    try {
      const sb = supabase()
      let query = sb
        .from('listings')
        .select(`${HOME_TILE_SELECT}, original_list_price`)
        .or(ACTIVE_OR)
        .not('list_price', 'is', null)
        .limit(300)
      if (city?.trim()) query = query.ilike('City', city.trim())
      const { data } = await query
      const rows = (data ?? []) as (HomeTileRow & { original_list_price?: number | null })[]
      const withDrop = rows.filter(
        (r) =>
          (r as { original_list_price?: number }).original_list_price != null &&
          r.ListPrice != null &&
          (r as { original_list_price: number }).original_list_price > r.ListPrice!
      )
      return withDrop.slice(0, 6).map((r) => ({
        ...r,
        originalPrice: (r as { original_list_price?: number }).original_list_price ?? undefined,
        savings:
          (r as { original_list_price?: number }).original_list_price != null && r.ListPrice != null
            ? (r as { original_list_price: number }).original_list_price - r.ListPrice
            : undefined,
      }))
    } catch {
      return []
    }
  }
}

/** Community highlights: top 6 by listing count (Bend city). */
async function _getCommunityHighlightsUncached(): Promise<HotCommunity[]> {
  const list = await getHotCommunitiesInCity('Bend')
  return list.slice(0, 6)
}

export const getCommunityHighlights = unstable_cache(
  _getCommunityHighlightsUncached,
  ['community-highlights'],
  { revalidate: 300, tags: ['community-highlights'] }
)

/** Same filters as `getMarketReportData` (condo or townhome allowed, no manufactured, land, or commercial). */
const SNAPSHOT_RESIDENTIAL: {
  includeCondoTown: boolean
  includeManufactured: boolean
  includeAcreage: boolean
  includeCommercial: boolean
} = {
  includeCondoTown: true,
  includeManufactured: false,
  includeAcreage: false,
  includeCommercial: false,
}

function mergeRegionalSalesTimeseries(
  rows: { timeseries: ReportMetricsTimeSeriesPoint[] | null }[]
): ReportMetricsTimeSeriesPoint[] {
  const byPeriod = new Map<string, { sold: number; monthLabel: string }>()
  for (const { timeseries } of rows) {
    for (const p of timeseries ?? []) {
      const key = p.period_start
      const prev = byPeriod.get(key)
      const sold = (p.sold_count ?? 0) + (prev?.sold ?? 0)
      byPeriod.set(key, { sold, monthLabel: prev?.monthLabel ?? p.month_label })
    }
  }
  return [...byPeriod.entries()]
    .map(([period_start, v]) => ({
      period_start,
      period_end: period_start,
      month_label: v.monthLabel,
      sold_count: v.sold,
      median_price: null,
    }))
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
}

export type MarketSnapshotResult = CityMarketStats & {
  avgDom?: number | null
  /** Combined monthly closed sales (sum across Central Oregon cities), residential filters applied. */
  regionSalesSeries: ReportMetricsTimeSeriesPoint[]
  /** Closed residential sales in the current calendar year through today (same period as cards). */
  closedYtdResidential: number
}

/** Central Oregon residential snapshot across MARKET_REPORT_DEFAULT_CITIES. */
async function _getMarketSnapshotUncached(): Promise<MarketSnapshotResult> {
  const empty: MarketSnapshotResult = {
    count: 0,
    avgPrice: null,
    medianPrice: null,
    avgDom: null,
    newListingsLast30Days: 0,
    pendingCount: 0,
    closedLast12Months: 0,
    regionSalesSeries: [],
    closedYtdResidential: 0,
  }

  const end = new Date()
  const start = new Date(end.getFullYear(), 0, 1)
  const periodStart = start.toISOString().slice(0, 10)
  const periodEnd = end.toISOString().slice(0, 10)
  const cities = [...MARKET_REPORT_DEFAULT_CITIES]

  try {
    const perCity = await Promise.all(
      cities.map(async (city) => {
        const [metricsRes, pulse, tsRes] = await Promise.all([
          getReportMetrics(city, periodStart, periodEnd, null, null, SNAPSHOT_RESIDENTIAL),
          getLiveMarketPulse({ geoType: 'city', geoSlug: slugify(city) }),
          getReportMetricsTimeSeries(city, 12, null, SNAPSHOT_RESIDENTIAL),
        ])
        return {
          city,
          metrics: metricsRes.data,
          pulse,
          timeseries: tsRes.data,
        }
      })
    )

    let activeSum = 0
    let pendingSum = 0
    let new30Sum = 0
    let closedYtd = 0
    let sales12Sum = 0
    let weightedMedianNumerator = 0
    let weightedMedianDenominator = 0
    let weightedDomNumerator = 0
    let weightedDomDenominator = 0

    for (const row of perCity) {
      const m = row.metrics
      if (!m) continue
      activeSum += m.current_listings
      closedYtd += m.sold_count
      sales12Sum += m.sales_12mo
      const sc = m.sold_count
      if (sc > 0 && m.median_price > 0) {
        weightedMedianNumerator += m.median_price * sc
        weightedMedianDenominator += sc
      }
      if (sc > 0 && m.median_dom > 0) {
        weightedDomNumerator += m.median_dom * sc
        weightedDomDenominator += sc
      }
      if (row.pulse) {
        pendingSum += row.pulse.pending_count
        new30Sum += row.pulse.new_count_30d
      }
    }

    const regionSalesSeries = mergeRegionalSalesTimeseries(perCity)

    return {
      count: activeSum,
      avgPrice: null,
      medianPrice:
        weightedMedianDenominator > 0
          ? Math.round(weightedMedianNumerator / weightedMedianDenominator)
          : null,
      avgDom:
        weightedDomDenominator > 0
          ? Math.round(weightedDomNumerator / weightedDomDenominator)
          : null,
      newListingsLast30Days: new30Sum,
      pendingCount: pendingSum,
      closedLast12Months: sales12Sum,
      regionSalesSeries,
      closedYtdResidential: closedYtd,
    }
  } catch {
    return empty
  }
}

export const getMarketSnapshot = unstable_cache(
  _getMarketSnapshotUncached,
  ['central-oregon-market-snapshot-v2'],
  { revalidate: 300, tags: ['market-snapshot'] }
)

const TRENDING_MIN_COUNT = 5

/** Trending: listings by view count (listing_views) for the given city; if fewer than 5, fill with newest listings. */
async function _getTrendingListingsUncached(city: string = 'Bend'): Promise<HomeTileRow[]> {
  const cityName = city.trim() || 'Bend'
  const keys = await getTrendingListingKeys(cityName, 12)
  const rows = keys.length > 0
    ? (await getHomeTileRowsByKeys(keys)).filter((r) =>
        /active|pending|for sale|coming soon/i.test(String(r.StandardStatus ?? ''))
      )
    : []
  if (rows.length >= TRENDING_MIN_COUNT) return rows.slice(0, TRENDING_MIN_COUNT)
  const haveKeys = new Set(rows.map((r) => (r.ListNumber ?? r.ListingKey ?? '').toString().trim()).filter(Boolean))
  const fillCount = TRENDING_MIN_COUNT - rows.length
  const newest = await getListingsForHomeTiles({ city: cityName, limit: fillCount + 8 })
  const extra = newest.filter((r) => {
    const k = (r.ListNumber ?? r.ListingKey ?? '').toString().trim()
    return k && !haveKeys.has(k)
  })
  const combined = [...rows, ...extra.slice(0, fillCount)]
  return combined.slice(0, TRENDING_MIN_COUNT)
}

export const getTrendingListings = unstable_cache(
  _getTrendingListingsUncached,
  ['trending-listings'],
  { revalidate: 60, tags: ['trending-listings'] }
)

/** Blog posts for homepage teaser. Returns empty until blog CMS exists. */
export async function getBlogPostsForHome(): Promise<Array<{
  id: string
  title: string
  excerpt: string
  slug: string
  imageUrl?: string | null
  publishedAt: string
  readTimeMinutes?: number
  category?: string | null
}>> {
  return []
}

/** Newsletter signup: push to FUB as lead with tag "newsletter-signup". */
export async function subscribeNewsletter(email: string): Promise<{ ok: boolean; error?: string }> {
  const e = email?.trim().toLowerCase()
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Invalid email' }
  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? 'ryan-realty.com').replace(/^https?:\/\//, '').replace(/\/$/, '')
  const result = await sendEvent({
    type: 'Registration',
    person: { emails: [{ value: e }] },
    source,
    message: 'newsletter-signup',
  })
  if (result.ok) return { ok: true }
  return { ok: false, error: result.error ?? 'Subscription failed' }
}
