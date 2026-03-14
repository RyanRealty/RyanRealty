'use server'

import { createClient } from '@supabase/supabase-js'

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
  minPrice?: number | null
  maxPrice?: number | null
}

/**
 * Metrics for a city (and optional subdivision) and date range.
 * Optional property type and price range filters.
 */
export async function getReportMetrics(
  city: string,
  periodStart: string,
  periodEnd: string,
  asOf?: string | null,
  subdivision?: string | null,
  filters?: ReportFilters | null
): Promise<{ data: ReportMetrics | null; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    return { data: null, error: 'Supabase not configured' }
  }
  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc('get_city_period_metrics', {
    p_city: city.trim(),
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_as_of: asOf ?? null,
    p_subdivision: subdivision?.trim() || null,
    p_include_condo_town: filters?.includeCondoTown ?? false,
    p_include_manufactured: filters?.includeManufactured ?? false,
    p_include_acreage: filters?.includeAcreage ?? false,
    p_min_price: filters?.minPrice ?? null,
    p_max_price: filters?.maxPrice ?? null,
  })
  if (error) {
    return { data: null, error: error.message }
  }
  return { data: data as ReportMetrics }
}

/**
 * Price band counts (sales and current listings) for a city (and optional subdivision) and period.
 */
export async function getReportPriceBands(
  city: string,
  periodStart: string,
  periodEnd: string,
  sales12mo: boolean = false,
  subdivision?: string | null,
  filters?: ReportFilters | null
): Promise<{ data: ReportPriceBandsResult | null; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    return { data: null, error: 'Supabase not configured' }
  }
  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc('get_city_price_bands', {
    p_city: city.trim(),
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_sales_12mo: sales12mo,
    p_subdivision: subdivision?.trim() || null,
    p_include_condo_town: filters?.includeCondoTown ?? false,
    p_include_manufactured: filters?.includeManufactured ?? false,
    p_include_acreage: filters?.includeAcreage ?? false,
    p_min_price: filters?.minPrice ?? null,
    p_max_price: filters?.maxPrice ?? null,
  })
  if (error) {
    return { data: null, error: error.message }
  }
  return { data: data as ReportPriceBandsResult }
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
 */
export async function getReportMetricsTimeSeries(
  city: string,
  numMonths: number = 12,
  subdivision?: string | null,
  filters?: ReportFilters | null
): Promise<{ data: ReportMetricsTimeSeriesPoint[] | null; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    return { data: null, error: 'Supabase not configured' }
  }
  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc('get_city_metrics_timeseries', {
    p_city: city.trim(),
    p_num_months: Math.min(60, Math.max(1, numMonths)),
    p_subdivision: subdivision?.trim() || null,
    p_include_condo_town: filters?.includeCondoTown ?? false,
    p_include_manufactured: filters?.includeManufactured ?? false,
    p_include_acreage: filters?.includeAcreage ?? false,
    p_min_price: filters?.minPrice ?? null,
    p_max_price: filters?.maxPrice ?? null,
  })
  if (error) {
    return { data: null, error: error.message }
  }
  const arr = Array.isArray(data) ? data : (data as unknown as ReportMetricsTimeSeriesPoint[]) ?? []
  return { data: arr }
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
  const supabase = createClient(url, key)
  const { data, error } = await supabase
    .from('listings')
    .select('SubdivisionName')
    .ilike('City', city.trim())
    .not('SubdivisionName', 'is', null)
    .limit(2000)
  if (error) return { subdivisions: [], error: error.message }
  const set = new Set<string>()
  for (const row of data ?? []) {
    const name = (row as { SubdivisionName?: string | null }).SubdivisionName?.trim()
    if (name && name.toLowerCase() !== 'n/a') set.add(name)
  }
  const subdivisions = Array.from(set).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  return { subdivisions }
}

/** Distinct cities in listings (for report dropdown). */
export async function getReportCities(): Promise<{ cities: string[]; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    return { cities: [] }
  }
  const supabase = createClient(url, key)
  const { data, error } = await supabase.from('listings').select('City').not('City', 'is', null)
  if (error) {
    return { cities: [], error: error.message }
  }
  const set = new Set<string>()
  for (const row of data ?? []) {
    const c = (row as { City?: string | null }).City
    if (typeof c === 'string' && c.trim()) set.add(c.trim())
  }
  const cities = Array.from(set).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  return { cities }
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
  const supabase = createClient(url, key)
  const pattern = `%${q}%`
  const { data, error } = await supabase
    .from('listings')
    .select('City, SubdivisionName, StreetNumber, StreetName')
    .or(`City.ilike.${pattern},SubdivisionName.ilike.${pattern},StreetName.ilike.${pattern},StreetNumber.ilike.${pattern}`)
    .limit(80)
  if (error) {
    return { locations: [], error: error.message }
  }
  const rows = (data ?? []) as {
    City?: string | null
    SubdivisionName?: string | null
    StreetNumber?: string | null
    StreetName?: string | null
  }[]
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
