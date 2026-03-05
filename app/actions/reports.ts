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

/**
 * Metrics for a city and date range (SFR only): sold count, median price, median DOM, etc.
 */
export async function getReportMetrics(
  city: string,
  periodStart: string,
  periodEnd: string,
  asOf?: string | null
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
  })
  if (error) {
    return { data: null, error: error.message }
  }
  return { data: data as ReportMetrics }
}

/**
 * Price band counts (sales and current listings) for a city and period.
 */
export async function getReportPriceBands(
  city: string,
  periodStart: string,
  periodEnd: string,
  sales12mo: boolean = false
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
  })
  if (error) {
    return { data: null, error: error.message }
  }
  return { data: data as ReportPriceBandsResult }
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
