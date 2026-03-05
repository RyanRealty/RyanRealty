'use server'

import { createClient } from '@supabase/supabase-js'

export type ReportListing = {
  listing_key: string
  event: string
  event_date: string | null
  city: string | null
  price: number | null
  description: string | null
}

export type MarketReportByCity = {
  city: string
  pending: ReportListing[]
  closed: ReportListing[]
}

/**
 * Fetch all listing_history events in the date range that are Pending or Closed,
 * then attach city from listings. Returns data grouped by city.
 */
export async function getMarketReportData(
  periodStart: Date,
  periodEnd: Date
): Promise<MarketReportByCity[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return []

  const supabase = createClient(url, anonKey)
  const startStr = periodStart.toISOString().slice(0, 10)
  const endStr = periodEnd.toISOString().slice(0, 10)

  const { data: historyRows } = await supabase
    .from('listing_history')
    .select('listing_key, event, event_date, price, description')
    .gte('event_date', `${startStr}T00:00:00.000Z`)
    .lte('event_date', `${endStr}T23:59:59.999Z`)
    .or('event.ilike.%Pending%,event.ilike.%Closed%')

  const rows = (historyRows ?? []) as Array<{
    listing_key: string
    event: string
    event_date: string | null
    price: number | null
    description: string | null
  }>
  if (rows.length === 0) return []

  const keys = [...new Set(rows.map((r) => r.listing_key).filter(Boolean))]
  const { data: listingData } = await supabase
    .from('listings')
    .select('ListingKey, ListNumber, City')
    .in('ListingKey', keys)

  const keyToCity = new Map<string, string>()
  for (const L of listingData ?? []) {
    const r = L as { ListingKey?: string; ListNumber?: string; City?: string }
    const city = (r.City ?? '').trim()
    if (r.ListingKey) keyToCity.set(r.ListingKey, city)
    if (r.ListNumber) keyToCity.set(r.ListNumber, city)
  }

  const byCity = new Map<string, { pending: ReportListing[]; closed: ReportListing[] }>()
  for (const row of rows) {
    const city = keyToCity.get(row.listing_key) ?? 'Other'
    if (!byCity.has(city)) byCity.set(city, { pending: [], closed: [] })
    const bucket = byCity.get(city)!
    const item: ReportListing = {
      listing_key: row.listing_key,
      event: row.event,
      event_date: row.event_date,
      city: city === 'Other' ? null : city,
      price: row.price,
      description: row.description,
    }
    const isClosed = /closed/i.test(row.event)
    if (isClosed) bucket.closed.push(item)
    else bucket.pending.push(item)
  }

  const cities = [...byCity.keys()].filter((c) => c !== 'Other').sort((a, b) => a.localeCompare(b))
  if (byCity.has('Other')) cities.push('Other')
  return cities.map((city) => ({
    city,
    pending: byCity.get(city)!.pending,
    closed: byCity.get(city)!.closed,
  }))
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
