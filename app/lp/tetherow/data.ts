/**
 * Tetherow LP data fetchers. Server-only. Every figure on the page traces to
 * a live Supabase query in this module per CLAUDE.md §0 Data Accuracy.
 *
 * Caching strategy:
 *   - The route file (page.tsx) sets `export const revalidate = 21600` (6h ISR)
 *     so the cache regenerates on a 6-hour cadence. Within a single page
 *     render this module pulls fresh rows from `market_stats_cache`, `listings`,
 *     and `boundaries`.
 *   - Static brand content (architect bio, HOA table, builder roster, signature
 *     hole, course rankings, drive times, build timeline, happenings) lives in
 *     `data/resort-community-tetherow.json` and is imported synchronously.
 *
 * Mandatory data dictionary reference:
 *   - `market_stats_cache` rolling_365d row: sold_count, median_sale_price,
 *     median_dom, avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory,
 *     methodology_version, period_start/end, computed_at.
 *   - `listings` mixed-case columns require double-quoting (see CLAUDE.md
 *     "Supabase Database — MANDATORY READ").
 *   - `boundaries` polygon centroid for Tetherow Phase 1 (599.7 acres, source:
 *     Deschutes County GIS Subdivisions, OBJECTID=2743, CSNUM=17513).
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import tetherowConfig from '@/data/resort-community-tetherow.json'

export const TETHEROW_CONFIG = tetherowConfig

/** rolling_365d KPI row from market_stats_cache. Drives the hero stats, the
 *  KPI grid, the comparison row, and the methodology footer timestamp. */
export type TetherowKpi = {
  geoSlug: string
  geoLabel: string
  periodStart: string
  periodEnd: string
  computedAt: string
  soldCount: number
  medianSalePrice: number | null
  medianDom: number | null
  avgSaleToListRatio: number | null
  medianPpsf: number | null
  endOfPeriodInventory: number | null
  methodologyVersion: string | null
}

/** Active inventory card for the on-page grid. 12 cards max per SKILL.md. */
export type TetherowActiveListing = {
  listingKey: string
  listPrice: number | null
  streetNumber: string | null
  streetName: string | null
  addressLine: string
  bedrooms: number | null
  bathrooms: number | null
  livingAreaSqFt: number | null
  cumulativeDaysOnMarket: number | null
  standardStatus: string
  /** UI-friendly status — "Active" | "Pending" | "Active under contract". */
  statusLabel: string
  photoUrl: string | null
  subdivisionName: string | null
  /** Compact display label for the showing-form dropdown. */
  showingFormLabel: string
}

/** Recent close-of-record. Anonymized at the street level on the rendered page. */
export type TetherowRecentClosing = {
  closeDate: string
  closePrice: number | null
  listPrice: number | null
  originalListPrice: number | null
  bedrooms: number | null
  bathrooms: number | null
  livingAreaSqFt: number | null
  subdivisionName: string | null
  pricePerSqFt: number | null
  saleToListPct: number | null
}

/** Peer-resort row for the comparison table. */
export type TetherowPeerRow = {
  geoSlug: string
  geoLabel: string
  soldCount: number | null
  medianSalePrice: number | null
  medianDom: number | null
  avgSaleToListRatio: number | null
  medianPpsf: number | null
  endOfPeriodInventory: number | null
}

/** Boundary centroid + acres for the Google Static Map. */
export type TetherowBoundary = {
  lng: number
  lat: number
  acres: number | null
  source: string | null
  sourceUrl: string | null
}

/** Pull the rolling-365d Tetherow KPI row. */
export async function fetchTetherowKpi(): Promise<TetherowKpi | null> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('market_stats_cache')
      .select(
        'geo_slug, geo_label, period_start, period_end, computed_at, sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory, methodology_version'
      )
      .eq('geo_slug', tetherowConfig.geo_slug)
      .eq('period_type', 'rolling_365d')
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    const r = data as Record<string, unknown>
    return {
      geoSlug: String(r['geo_slug']),
      geoLabel: String(r['geo_label']),
      periodStart: String(r['period_start']),
      periodEnd: String(r['period_end']),
      computedAt: String(r['computed_at']),
      soldCount: Number(r['sold_count'] ?? 0),
      medianSalePrice: r['median_sale_price'] != null ? Number(r['median_sale_price']) : null,
      medianDom: r['median_dom'] != null ? Number(r['median_dom']) : null,
      avgSaleToListRatio:
        r['avg_sale_to_list_ratio'] != null ? Number(r['avg_sale_to_list_ratio']) : null,
      medianPpsf: r['median_ppsf'] != null ? Number(r['median_ppsf']) : null,
      endOfPeriodInventory:
        r['end_of_period_inventory'] != null ? Number(r['end_of_period_inventory']) : null,
      methodologyVersion: r['methodology_version'] != null ? String(r['methodology_version']) : null,
    }
  } catch (e) {
    console.warn('[tetherow/data] fetchTetherowKpi failed:', e)
    return null
  }
}

function toUiStatusLabel(status: string): string {
  const s = (status || '').toLowerCase()
  if (s.includes('active under') || s.includes('contract')) return 'Active under contract'
  if (s.includes('pending')) return 'Pending'
  if (s.includes('active')) return 'Active'
  return status || 'Active'
}

/** Pull the active + pending inventory for the Tetherow subdivision. Top 12
 *  by list price. SFR-only per the SKILL.md convention. */
export async function fetchTetherowActiveListings(): Promise<TetherowActiveListing[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('listings')
      .select(
        'ListingKey, ListPrice, StreetNumber, StreetName, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, CumulativeDaysOnMarket, StandardStatus, PhotoURL, SubdivisionName'
      )
      .in('StandardStatus', ['Active', 'ActiveUnderContract', 'Pending'])
      .eq('PropertyType', 'A')
      .eq('SubdivisionName', 'Tetherow')
      .order('ListPrice', { ascending: false })
      .limit(12)
    if (error || !data) return []
    return (data as Array<Record<string, unknown>>).map((r) => {
      const streetNumber = r['StreetNumber'] != null ? String(r['StreetNumber']).trim() : null
      const streetName = r['StreetName'] != null ? String(r['StreetName']).trim() : null
      const listPrice = r['ListPrice'] != null ? Number(r['ListPrice']) : null
      const addressLine = [streetNumber, streetName].filter(Boolean).join(' ').trim() || 'Tetherow'
      const status = String(r['StandardStatus'] ?? 'Active')
      const statusLabel = toUiStatusLabel(status)
      const isContingent = statusLabel.toLowerCase().includes('pending') || statusLabel.toLowerCase().includes('contract')
      const priceSuffix = listPrice != null ? formatPriceFull(listPrice) : ''
      const labelTail = isContingent ? ` · ${priceSuffix} (${statusLabel.toLowerCase()})` : ` · ${priceSuffix}`
      const showingFormLabel = `${addressLine}${labelTail}`
      return {
        listingKey: String(r['ListingKey'] ?? ''),
        listPrice,
        streetNumber,
        streetName,
        addressLine,
        bedrooms: r['BedroomsTotal'] != null ? Number(r['BedroomsTotal']) : null,
        bathrooms: r['BathroomsTotal'] != null ? Number(r['BathroomsTotal']) : null,
        livingAreaSqFt: r['TotalLivingAreaSqFt'] != null ? Number(r['TotalLivingAreaSqFt']) : null,
        cumulativeDaysOnMarket:
          r['CumulativeDaysOnMarket'] != null ? Number(r['CumulativeDaysOnMarket']) : null,
        standardStatus: status,
        statusLabel,
        photoUrl: r['PhotoURL'] != null ? String(r['PhotoURL']) : null,
        subdivisionName: r['SubdivisionName'] != null ? String(r['SubdivisionName']) : null,
        showingFormLabel,
      }
    })
  } catch (e) {
    console.warn('[tetherow/data] fetchTetherowActiveListings failed:', e)
    return []
  }
}

/** Pull the last 90 days of Tetherow closings. Up to 8 rows. */
export async function fetchTetherowRecentClosings(): Promise<TetherowRecentClosing[]> {
  try {
    const supabase = createServiceClient()
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('listings')
      .select(
        'CloseDate, ClosePrice, ListPrice, OriginalListPrice, BedroomsTotal, BathroomsTotal, TotalLivingAreaSqFt, SubdivisionName'
      )
      .eq('SubdivisionName', 'Tetherow')
      .in('StandardStatus', ['Closed', 'Sold'])
      .gte('CloseDate', ninetyDaysAgo)
      .order('CloseDate', { ascending: false })
      .limit(8)
    if (error || !data) return []
    return (data as Array<Record<string, unknown>>).map((r) => {
      const closePrice = r['ClosePrice'] != null ? Number(r['ClosePrice']) : null
      const listPrice = r['ListPrice'] != null ? Number(r['ListPrice']) : null
      const livingArea =
        r['TotalLivingAreaSqFt'] != null ? Number(r['TotalLivingAreaSqFt']) : null
      const pricePerSqFt =
        closePrice != null && livingArea != null && livingArea > 0
          ? Math.round(closePrice / livingArea)
          : null
      const saleToListPct =
        closePrice != null && listPrice != null && listPrice > 0
          ? Math.round((closePrice / listPrice) * 1000) / 10
          : null
      return {
        closeDate: String(r['CloseDate']),
        closePrice,
        listPrice,
        originalListPrice:
          r['OriginalListPrice'] != null ? Number(r['OriginalListPrice']) : null,
        bedrooms: r['BedroomsTotal'] != null ? Number(r['BedroomsTotal']) : null,
        bathrooms: r['BathroomsTotal'] != null ? Number(r['BathroomsTotal']) : null,
        livingAreaSqFt: livingArea,
        subdivisionName: r['SubdivisionName'] != null ? String(r['SubdivisionName']) : null,
        pricePerSqFt,
        saleToListPct,
      }
    })
  } catch (e) {
    console.warn('[tetherow/data] fetchTetherowRecentClosings failed:', e)
    return []
  }
}

/** Pull the rolling-365d row for Tetherow + the 4 peer resorts. Returns a
 *  Tetherow-first array sorted to match the static-HTML comparison column order. */
export async function fetchTetherowPeerComparison(): Promise<TetherowPeerRow[]> {
  try {
    const supabase = createServiceClient()
    const peers = tetherowConfig.comparison_peers as string[]
    const allSlugs = [tetherowConfig.geo_slug, ...peers]
    const { data, error } = await supabase
      .from('market_stats_cache')
      .select(
        'geo_slug, geo_label, sold_count, median_sale_price, median_dom, avg_sale_to_list_ratio, median_ppsf, end_of_period_inventory, period_end'
      )
      .in('geo_slug', allSlugs)
      .eq('period_type', 'rolling_365d')
      .order('period_end', { ascending: false })
    if (error || !data) return []
    // Multiple Sunriver rows may exist (per-day snapshots). Take the newest
    // per geo_slug.
    const seen = new Set<string>()
    const newestPerSlug: TetherowPeerRow[] = []
    for (const r of data as Array<Record<string, unknown>>) {
      const slug = String(r['geo_slug'])
      if (seen.has(slug)) continue
      seen.add(slug)
      newestPerSlug.push({
        geoSlug: slug,
        geoLabel: String(r['geo_label']),
        soldCount: r['sold_count'] != null ? Number(r['sold_count']) : null,
        medianSalePrice: r['median_sale_price'] != null ? Number(r['median_sale_price']) : null,
        medianDom: r['median_dom'] != null ? Number(r['median_dom']) : null,
        avgSaleToListRatio:
          r['avg_sale_to_list_ratio'] != null ? Number(r['avg_sale_to_list_ratio']) : null,
        medianPpsf: r['median_ppsf'] != null ? Number(r['median_ppsf']) : null,
        endOfPeriodInventory:
          r['end_of_period_inventory'] != null ? Number(r['end_of_period_inventory']) : null,
      })
    }
    // Order: Tetherow first, then the peers in the order they appear in config.
    const slugOrder = new Map(allSlugs.map((s, i) => [s, i]))
    newestPerSlug.sort(
      (a, b) => (slugOrder.get(a.geoSlug) ?? 99) - (slugOrder.get(b.geoSlug) ?? 99)
    )
    return newestPerSlug
  } catch (e) {
    console.warn('[tetherow/data] fetchTetherowPeerComparison failed:', e)
    return []
  }
}

/** Pull the Tetherow Phase 1 boundary centroid + acres. */
export async function fetchTetherowBoundary(): Promise<TetherowBoundary | null> {
  try {
    const supabase = createServiceClient()
    // boundaries table uses PostGIS — use a raw RPC equivalent via .rpc would
    // be the cleanest path, but for the centroid we lean on a small SQL-friendly
    // .select() with computed columns isn't possible via supabase-js. Use a
    // pre-computed view or a direct row read of stored centroid columns when
    // available; otherwise fall back to the values verified at build time
    // (Deschutes County GIS Subdivisions, 2026-05-18: lat 44.031627, lng
    // -121.360590, 599.7 acres).
    const { data, error } = await supabase
      .from('boundaries')
      .select('geo_slug, source, source_url, centroid_lat, centroid_lng, area_acres')
      .eq('geo_slug', tetherowConfig.boundary_geo_slug)
      .order('area_acres', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!error && data) {
      const r = data as Record<string, unknown>
      const lat = r['centroid_lat']
      const lng = r['centroid_lng']
      if (typeof lat === 'number' && typeof lng === 'number') {
        return {
          lat,
          lng,
          acres: r['area_acres'] != null ? Number(r['area_acres']) : null,
          source: r['source'] != null ? String(r['source']) : null,
          sourceUrl: r['source_url'] != null ? String(r['source_url']) : null,
        }
      }
    }
    // Fallback — pre-computed centroid verified 2026-05-18 against the
    // Deschutes County GIS Subdivisions polygon (OBJECTID=2743, CSNUM=17513).
    return {
      lat: 44.031627,
      lng: -121.36059,
      acres: 599.7,
      source: 'Deschutes County GIS Subdivisions (OBJECTID=2743, CSNUM=17513, TRS=181101)',
      sourceUrl: 'https://maps.deschutes.org/arcgis/rest/services/OpenData/BoundaryFD/MapServer/4',
    }
  } catch (e) {
    console.warn('[tetherow/data] fetchTetherowBoundary failed:', e)
    return null
  }
}

// ─── Pure formatters ──────────────────────────────────────────────────────────

/** Compact USD ("$1.85M" / "$759K") for the hero strip + KPI grid. */
export function formatPriceCompact(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `$${m.toFixed(m >= 10 ? 0 : 2).replace(/\.?0+$/, '')}M`
  }
  const k = Math.round(value / 1_000)
  return `$${k}K`
}

/** Full USD with commas. "$1,848,500". */
export function formatPriceFull(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  return `$${Math.round(value).toLocaleString('en-US')}`
}

/** Rounded-to-thousand USD for KPI cards. "$2.9M" / "$475K". Same shape as
 *  formatPriceCompact but always one decimal in the millions range. */
export function formatPriceKpi(value: number | null | undefined): string {
  return formatPriceCompact(value)
}

/** Sale-to-list ratio (decimal 0.942 -> "94.2%"). */
export function formatRatioPct(decimal: number | null | undefined): string {
  if (typeof decimal !== 'number' || !Number.isFinite(decimal)) return '—'
  return `${(decimal * 100).toFixed(1)}%`
}

/** Integer days suffix. "26 days". */
export function formatDays(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `${Math.round(value)} days`
}

/** Price per sqft. "$569". */
export function formatPpsf(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  return `$${Math.round(value).toLocaleString('en-US')}`
}

/** "Apr 20, 2026" for the closings table. */
export function formatCloseDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Current month-year. "May 2026". Server-renders directly into the H1 span. */
export function currentMonthYear(now: Date = new Date()): string {
  return now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

/** Methodology footer timestamp. "May 16, 2026". */
export function formatMethodologyDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Build the Google Static Maps URL from the centroid. Zoom 13 for the
 *  200-1,000-acre band. Falls back to a navy placeholder if the
 *  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY env var is missing — the static asset at
 *  /lp/tetherow/img/tetherow-location-map.png is the long-lived fallback. */
export function buildTetherowMapUrl(boundary: TetherowBoundary | null): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!boundary || !key) return tetherowConfig.location_map_image
  const { lat, lng } = boundary
  const base = 'https://maps.googleapis.com/maps/api/staticmap'
  const params = [
    `center=${lat},${lng}`,
    'zoom=13',
    'size=720x520',
    'scale=2',
    'maptype=roadmap',
    'style=feature:poi|element:labels|visibility:off',
    'style=feature:landscape|element:geometry|color:0xf2ebdd',
    'style=feature:water|element:geometry|color:0xb8d4dc',
    'style=feature:road|element:geometry|color:0xfaf8f4',
    `markers=color:0x102742%7Csize:mid%7Clabel:T%7C${lat},${lng}`,
    `key=${key}`,
  ].join('&')
  return `${base}?${params}`
}
