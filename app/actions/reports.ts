'use server'

import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { slugify, subdivisionEntityKey } from '@/lib/slug'
import { getAllCitySnapshots } from '@/lib/data'

export type ReportMetrics = {
  sold_count: number
  median_price: number
  median_dom: number
  median_ppsf: number
  current_listings: number
  sales_12mo: number
  inventory_months: number | null
}

export type ReportPriceBand = { band: string; cnt: number }

export type ReportPriceBandsResult = {
  sales_by_band: ReportPriceBand[]
  current_listings_by_band: ReportPriceBand[]
}

export type ReportFilters = {
  includeCondoTown?: boolean
  includeManufactured?: boolean
  includeAcreage?: boolean
  includeCommercial?: boolean
  minPrice?: number | null
  maxPrice?: number | null
}

/**
 * Metrics for a city (and optional subdivision) and date range.
 * Optional property type and price range filters.
 * Result is cached 3600s (revalidate tag: market-reports).
 * Throws on RPC error so unstable_cache never stores a poison result.
 */
const _fetchReportMetrics = unstable_cache(
  async (
    city: string,
    periodStart: string,
    periodEnd: string,
    asOf: string | null,
    subdivision: string | null,
    includeCondoTown: boolean,
    includeManufactured: boolean,
    includeAcreage: boolean,
    includeCommercial: boolean,
    minPrice: number | null,
    maxPrice: number | null,
  ): Promise<ReportMetrics> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url?.trim() || !key?.trim()) throw new Error('Supabase not configured')
    const supabase = createClient(url, key)
    const { data, error } = await supabase.rpc('get_city_period_metrics', {
      p_city: city.trim(),
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_as_of: asOf,
      p_subdivision: subdivision,
      p_include_condo_town: includeCondoTown,
      p_include_manufactured: includeManufactured,
      p_include_acreage: includeAcreage,
      p_include_commercial: includeCommercial,
      p_min_price: minPrice,
      p_max_price: maxPrice,
    })
    if (error) throw new Error(error.message)
    return data as ReportMetrics
  },
  ['report-metrics-v1'],
  { revalidate: 3600, tags: ['market-reports'] },
)

export async function getReportMetrics(
  city: string,
  periodStart: string,
  periodEnd: string,
  asOf?: string | null,
  subdivision?: string | null,
  filters?: ReportFilters | null
): Promise<{ data: ReportMetrics | null; error?: string }> {
  try {
    const data = await _fetchReportMetrics(
      city,
      periodStart,
      periodEnd,
      asOf ?? null,
      subdivision?.trim() || null,
      filters?.includeCondoTown ?? false,
      filters?.includeManufactured ?? false,
      filters?.includeAcreage ?? false,
      filters?.includeCommercial ?? false,
      filters?.minPrice ?? null,
      filters?.maxPrice ?? null,
    )
    return { data }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Price band counts (sales and current listings) for a city (and optional subdivision) and period.
 * Result is cached 3600s (revalidate tag: market-reports).
 * Throws on RPC error so unstable_cache never stores a poison result.
 */
const _fetchReportPriceBands = unstable_cache(
  async (
    city: string,
    periodStart: string,
    periodEnd: string,
    sales12mo: boolean,
    subdivision: string | null,
    includeCondoTown: boolean,
    includeManufactured: boolean,
    includeAcreage: boolean,
    includeCommercial: boolean,
    minPrice: number | null,
    maxPrice: number | null,
  ): Promise<ReportPriceBandsResult> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url?.trim() || !key?.trim()) throw new Error('Supabase not configured')
    const supabase = createClient(url, key)
    const { data, error } = await supabase.rpc('get_city_price_bands', {
      p_city: city.trim(),
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_sales_12mo: sales12mo,
      p_subdivision: subdivision,
      p_include_condo_town: includeCondoTown,
      p_include_manufactured: includeManufactured,
      p_include_acreage: includeAcreage,
      p_include_commercial: includeCommercial,
      p_min_price: minPrice,
      p_max_price: maxPrice,
    })
    if (error) throw new Error(error.message)
    return data as ReportPriceBandsResult
  },
  ['report-price-bands-v1'],
  { revalidate: 3600, tags: ['market-reports'] },
)

export async function getReportPriceBands(
  city: string,
  periodStart: string,
  periodEnd: string,
  sales12mo: boolean = false,
  subdivision?: string | null,
  filters?: ReportFilters | null
): Promise<{ data: ReportPriceBandsResult | null; error?: string }> {
  try {
    const data = await _fetchReportPriceBands(
      city,
      periodStart,
      periodEnd,
      sales12mo,
      subdivision?.trim() || null,
      filters?.includeCondoTown ?? false,
      filters?.includeManufactured ?? false,
      filters?.includeAcreage ?? false,
      filters?.includeCommercial ?? false,
      filters?.minPrice ?? null,
      filters?.maxPrice ?? null,
    )
    return { data }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export type ReportMetricsTimeSeriesPoint = {
  period_start: string
  period_end: string
  month_label: string
  sold_count: number
  median_price: number | null
}

/**
 * Monthly time-series of sold count and median price (city, optional subdivision, last N months).
 * Result is cached 3600s (revalidate tag: market-reports).
 * Throws on RPC error so unstable_cache never stores a poison result.
 */
const _fetchReportMetricsTimeSeries = unstable_cache(
  async (
    city: string,
    numMonths: number,
    subdivision: string | null,
    includeCondoTown: boolean,
    includeManufactured: boolean,
    includeAcreage: boolean,
    includeCommercial: boolean,
    minPrice: number | null,
    maxPrice: number | null,
  ): Promise<ReportMetricsTimeSeriesPoint[]> => {
    const hasCustomFilters =
      includeCondoTown || includeManufactured || includeAcreage || includeCommercial ||
      minPrice != null || maxPrice != null

    // Default path: read precomputed monthly cache rows (no RPC, no pool pressure).
    if (!hasCustomFilters) {
      const geoSlug = subdivision
        ? subdivisionEntityKey(city.trim(), subdivision.trim())
        : slugify(city.trim())
      const { getMarketStatsCacheRowsForGeos } = await import('@/lib/data')
      const cacheRows = await getMarketStatsCacheRowsForGeos({
        geoSlugs: [geoSlug],
        periodType: 'monthly',
        columns: 'geo_slug, period_start, period_end, sold_count, median_sale_price',
        orderBy: { column: 'period_start', ascending: false },
      })
      if (Array.isArray(cacheRows) && cacheRows.length > 0) {
        const sliced = cacheRows.slice(0, Math.min(60, Math.max(1, numMonths)))
        return sliced
          .map((row) => {
            const periodStart = String((row as { period_start?: string }).period_start ?? '')
            const monthDate = new Date(periodStart)
            const monthLabel = Number.isNaN(monthDate.getTime())
              ? periodStart
              : monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            return {
              period_start: periodStart,
              period_end: String((row as { period_end?: string }).period_end ?? periodStart),
              month_label: monthLabel,
              sold_count: Number((row as { sold_count?: number }).sold_count ?? 0),
              median_price: (row as { median_sale_price?: number | null }).median_sale_price ?? null,
            } satisfies ReportMetricsTimeSeriesPoint
          })
          .sort((a, b) => a.period_start.localeCompare(b.period_start))
      }
    }

    // Fallback: live RPC (custom filters or no cache rows). Throw on error.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url?.trim() || !key?.trim()) throw new Error('Supabase not configured')
    const supabase = createClient(url, key)
    const { data, error } = await supabase.rpc('get_city_metrics_timeseries', {
      p_city: city.trim(),
      p_num_months: Math.min(60, Math.max(1, numMonths)),
      p_subdivision: subdivision,
      p_include_condo_town: includeCondoTown,
      p_include_manufactured: includeManufactured,
      p_include_acreage: includeAcreage,
      p_include_commercial: includeCommercial,
      p_min_price: minPrice,
      p_max_price: maxPrice,
    })
    if (error) throw new Error(error.message)
    return Array.isArray(data) ? data : (data as unknown as ReportMetricsTimeSeriesPoint[]) ?? []
  },
  ['report-metrics-timeseries-v1'],
  { revalidate: 3600, tags: ['market-reports'] },
)

export async function getReportMetricsTimeSeries(
  city: string,
  numMonths: number = 12,
  subdivision?: string | null,
  filters?: ReportFilters | null
): Promise<{ data: ReportMetricsTimeSeriesPoint[] | null; error?: string }> {
  try {
    const data = await _fetchReportMetricsTimeSeries(
      city,
      numMonths,
      subdivision?.trim() || null,
      filters?.includeCondoTown ?? false,
      filters?.includeManufactured ?? false,
      filters?.includeAcreage ?? false,
      filters?.includeCommercial ?? false,
      filters?.minPrice ?? null,
      filters?.maxPrice ?? null,
    )
    return { data }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Subdivision names that have listings in the given city (for report location filter).
 */
export async function getReportSubdivisionsForCity(city: string): Promise<{ subdivisions: string[]; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim() || !city?.trim()) {
    return { subdivisions: [] }
  }
  void createClient
  const { getCityListings: getCityListingsDAL } = await import('@/lib/data')
  const tiles = await getCityListingsDAL(city.trim(), { status: 'all', limit: 5000 })
  const set = new Set<string>()
  for (const t of tiles) {
    const name = (t.subdivisionName ?? '').trim()
    if (name && name.toLowerCase() !== 'n/a') set.add(name)
  }
  const subdivisions = Array.from(set).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  return { subdivisions }
}

/** Distinct cities in listings (for report dropdown). Reads from
 * geo_snapshot_mv via the DAL — sub-2ms vs the prior 10000-row fetch. */
export async function getReportCities(): Promise<{ cities: string[]; error?: string }> {
  try {
    const snapshots = await getAllCitySnapshots()
    const cities = snapshots
      .map((s) => s.geoLabel)
      .filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    return { cities }
  } catch (err) {
    return {
      cities: [],
      error: err instanceof Error ? err.message : 'getAllCitySnapshots failed',
    }
  }
}

export type ReportLocation = {
  type: 'city' | 'subdivision' | 'address'
  city: string
  subdivision?: string
  label: string
}

/**
 * Search locations for market reports: cities, communities/subdivisions, or addresses.
 * Type-ahead: pass partial query (e.g. "sun", "bend", "123 main") and get matching places.
 */
export async function searchReportLocations(
  query: string
): Promise<{ locations: ReportLocation[]; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    return { locations: [] }
  }
  const q = (query || '').trim()
  if (q.length < 2) {
    return { locations: [] }
  }
  void createClient
  const safeQ = q.replace(/[,()\\%]/g, '')
  const { getListingTiles } = await import('@/lib/data')
  const tiles = await getListingTiles({ searchQuery: safeQ, status: 'all', sort: 'newest', limit: 80 })
  const rows = tiles.map((t) => ({
    City: t.city,
    SubdivisionName: t.subdivisionName,
    StreetNumber: t.streetNumber,
    StreetName: t.streetName,
  }))
  const citySet = new Set<string>()
  const subdivisionSet = new Set<string>()
  const addressList: { city: string; subdivision?: string; street: string }[] = []
  for (const r of rows) {
    const city = (r.City ?? '').trim()
    if (!city) continue
    const sub = (r.SubdivisionName ?? '').trim()
    const street = [r.StreetNumber, r.StreetName].filter(Boolean).join(' ').trim()
    if (street && (street.toLowerCase().includes(q.toLowerCase()) || (r.StreetNumber ?? '').toString().includes(q))) {
      addressList.push({ city, subdivision: sub || undefined, street })
    }
    citySet.add(city)
    if (sub) {
      subdivisionSet.add(`${sub}\t${city}`)
    }
  }
  const locations: ReportLocation[] = []
  const seenLabels = new Set<string>()
  const add = (loc: ReportLocation) => {
    if (seenLabels.has(loc.label)) return
    seenLabels.add(loc.label)
    locations.push(loc)
  }
  Array.from(citySet)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .forEach((city) => {
      if (city.toLowerCase().includes(q.toLowerCase())) {
        add({ type: 'city', city, label: city })
      }
    })
  Array.from(subdivisionSet)
    .sort()
    .forEach((pair) => {
      const [sub, city] = pair.split('\t')
      if (sub.toLowerCase().includes(q.toLowerCase()) || city.toLowerCase().includes(q.toLowerCase())) {
        add({ type: 'subdivision', city, subdivision: sub, label: `${sub}, ${city}` })
      }
    })
  const seenAddresses = new Set<string>()
  addressList.forEach(({ city, subdivision, street }) => {
    const label = subdivision ? `${street}, ${subdivision}, ${city}` : `${street}, ${city}`
    if (seenAddresses.has(label)) return
    seenAddresses.add(label)
    add({ type: 'address', city, subdivision, label })
  })
  // Trim to 25 total (cities + subdivisions + addresses)
  return { locations: locations.slice(0, 25) }
}
