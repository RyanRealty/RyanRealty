import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange } from './getAgentActivityReport'
import type { DatePreset } from './getAgentActivityReport'

export type { DatePreset }

// ── Types ─────────────────────────────────────────────────────────────────────

export type PropertiesParams = {
  datePreset: DatePreset | 'custom'
  dateStart?: string | null
  dateEnd?: string | null
}

export type PropertyInquiryRow = {
  listingMls: string
  streetNumber: string
  streetName: string
  city: string
  postalCode: string
  /** Human-readable label: "615 Ogden, Bend, OR 97703" */
  fullAddress: string
  viewCount: number
  lat: number | null
  lng: number | null
  /** Canonical listing detail page URL for drill-through */
  listingUrl: string | null
}

export type PropertiesReportResult = {
  /** Ranked by viewCount DESC, then alphabetical by fullAddress */
  rows: PropertyInquiryRow[]
  /** Exact DB COUNT(*) of all listing_view events in the period */
  totalViews: number
  /** Distinct listing_mls values (unique properties viewed) */
  uniqueProperties: number
  dateStart: string
  dateEnd: string
}

// ── URL address extraction ────────────────────────────────────────────────────
//
// visitor_events stores the listing address in page_url but not in the dedicated
// columns (listing_street, listing_city, etc. are null for current events).
// This extracts a best-effort street + city from the URL slug pattern:
//
//   /homes-for-sale/CITY-SLUG/[SUBDIV-SLUG/]STREET_NUM-STREET_NAME-MLS_KEY
//
// Used only when the listings table has no row for a given listing_mls.

function extractAddressFromUrl(
  pageUrl: string,
  mlsKey: string,
): { street: string; city: string } {
  try {
    const u = new URL(pageUrl)
    const segs = u.pathname.split('/').filter(Boolean)
    const hsIdx = segs.indexOf('homes-for-sale')
    if (hsIdx < 0) return { street: '', city: '' }

    const citySlug = segs[hsIdx + 1] ?? ''
    const lastSeg = segs[segs.length - 1] ?? ''

    // Strip the MLS key suffix from the last segment.
    // Patterns seen: "19015-park-commons-220222511" or "13375-forest-service-20260529212342583408000000"
    const mlsEscaped = mlsKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const withoutMls = lastSeg
      .replace(new RegExp(`-${mlsEscaped}$`), '')
      // also strip any trailing long internal key (≥16 alphanumeric chars)
      .replace(/-[a-z0-9]{16,}$/i, '')

    const street = withoutMls.replace(/-/g, ' ')
    const city = citySlug
      .split('-')
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ')

    return { street, city }
  } catch {
    return { street: '', city: '' }
  }
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readPropertiesReport(
  params: PropertiesParams,
): Promise<PropertiesReportResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(
    params.datePreset,
    params.dateStart,
    params.dateEnd,
  )

  // 1. Exact total-view count — only attributed events (non-null listing_mls).
  //    91/127 June 2026 events have listing_mls=null (URL pattern /listing/<long-id>
  //    where the tracker doesn't populate the MLS field). Excluding nulls keeps
  //    totalViews consistent with the sum of viewCounts shown in the ranked list.
  //    Never uses rows.length — always { count: 'exact', head: true }.
  const { count: totalViews, error: countError } = await sb
    .from('visitor_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'listing_view')
    .not('listing_mls', 'is', null)
    .gte('event_at', start)
    .lte('event_at', end)

  if (countError) {
    console.error('[getPropertiesReport] count error', countError.message)
  }

  // 2. Paginate all listing_view events to aggregate per MLS.
  //    Pagination guards against the PostgREST 1000-row cap on data fetches.
  //    (Currently ~150 total events all-time; this future-proofs the report.)
  type VisitorEventRow = {
    listing_mls: string | null
    page_url: string
    event_at: string
  }

  const allEvents: VisitorEventRow[] = []
  const PAGE_SIZE = 1000
  let offset = 0
  let done = false

  while (!done) {
    const { data, error } = await sb
      .from('visitor_events')
      .select('listing_mls,page_url,event_at')
      .eq('event_type', 'listing_view')
      .gte('event_at', start)
      .lte('event_at', end)
      .range(offset, offset + PAGE_SIZE - 1)
      .order('event_at', { ascending: false })

    if (error) {
      console.error('[getPropertiesReport] events page error', error.message)
      break
    }

    const page = (data ?? []) as VisitorEventRow[]
    allEvents.push(...page)
    if (page.length < PAGE_SIZE) {
      done = true
    } else {
      offset += PAGE_SIZE
    }
  }

  // 3. Aggregate: count views per listing_mls, keep one page_url per listing.
  const mlsMap = new Map<
    string,
    { viewCount: number; pageUrl: string }
  >()

  for (const ev of allEvents) {
    const key = ev.listing_mls?.trim() ?? ''
    if (!key) continue
    const existing = mlsMap.get(key)
    if (existing) {
      existing.viewCount++
    } else {
      mlsMap.set(key, { viewCount: 1, pageUrl: ev.page_url })
    }
  }

  const uniqueProperties = mlsMap.size
  if (uniqueProperties === 0) {
    return {
      rows: [],
      totalViews: totalViews ?? 0,
      uniqueProperties: 0,
      dateStart: start,
      dateEnd: end,
    }
  }

  // 4. Batch-fetch listing addresses from the listings table.
  //    visitor_events.listing_mls matches listings."ListNumber" (the human-readable
  //    MLS number, e.g. "220224201"). Some long internal keys won't match; those
  //    fall back to URL extraction.
  const allMlsIds = Array.from(mlsMap.keys())

  // listings."ListNumber" join
  const { data: listingRows, error: listingError } = await sb
    .from('listings')
    .select('ListNumber,StreetNumber,StreetName,City,PostalCode,Latitude,Longitude')
    .in('ListNumber', allMlsIds)

  if (listingError) {
    console.error('[getPropertiesReport] listings lookup error', listingError.message)
  }

  // Build a map of MLS → listing data (typed exactly as PostgREST returns it)
  type ListingLookup = {
    ListNumber: string
    StreetNumber: string | null
    StreetName: string | null
    City: string | null
    PostalCode: string | null
    Latitude: number | null
    Longitude: number | null
  }

  const listingByMls = new Map<string, ListingLookup>()
  for (const row of (listingRows ?? []) as ListingLookup[]) {
    listingByMls.set(row.ListNumber, row)
  }

  // 5. Build final rows with resolved addresses.
  const rows: PropertyInquiryRow[] = []

  for (const [mlsKey, agg] of mlsMap) {
    const listing = listingByMls.get(mlsKey)

    let streetNumber = ''
    let streetName = ''
    let city = ''
    let postalCode = ''
    let lat: number | null = null
    let lng: number | null = null

    if (listing) {
      streetNumber = listing.StreetNumber ?? ''
      streetName = listing.StreetName ?? ''
      city = listing.City ?? ''
      postalCode = listing.PostalCode ?? ''
      lat = listing.Latitude !== null ? Number(listing.Latitude) : null
      lng = listing.Longitude !== null ? Number(listing.Longitude) : null
    } else {
      // Fallback: extract from page URL
      const extracted = extractAddressFromUrl(agg.pageUrl, mlsKey)
      streetName = extracted.street
      city = extracted.city
    }

    // Canonical listing URL — reconstruct from page_url (it IS the canonical URL)
    // Strip query params for the display link.
    let listingUrl: string | null = null
    try {
      const u = new URL(agg.pageUrl)
      listingUrl = u.pathname
    } catch {
      listingUrl = null
    }

    const streetDisplay = streetNumber ? `${streetNumber} ${streetName}`.trim() : streetName.trim()
    const locationDisplay = [city, postalCode ? `OR ${postalCode}` : 'OR']
      .filter(Boolean)
      .join(', ')
    const fullAddress = [streetDisplay, locationDisplay].filter(Boolean).join(', ')

    rows.push({
      listingMls: mlsKey,
      streetNumber,
      streetName,
      city,
      postalCode,
      fullAddress: fullAddress || `Listing #${mlsKey}`,
      viewCount: agg.viewCount,
      lat,
      lng,
      listingUrl,
    })
  }

  // 6. Sort: most views first, then alphabetical by fullAddress.
  rows.sort((a, b) => {
    if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount
    return a.fullAddress.localeCompare(b.fullAddress)
  })

  return {
    rows,
    totalViews: totalViews ?? allEvents.length,
    uniqueProperties,
    dateStart: start,
    dateEnd: end,
  }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Properties report — which listing pages visitors viewed most, with addresses
 * and map coordinates.  Cached 10 minutes to match FUB's reporting cache TTL.
 *
 * Metric → source mapping:
 *   totalViews       → visitor_events WHERE event_type='listing_view', COUNT(*) exact
 *   uniqueProperties → visitor_events DISTINCT listing_mls, aggregated in JS after paginated fetch
 *   rows[].viewCount → visitor_events grouped by listing_mls, aggregated in JS
 *   rows[].address   → listings."ListNumber" JOIN on listing_mls (PostgREST batch fetch)
 *   rows[].lat/lng   → listings."Latitude"/"Longitude" (same join)
 *
 * V1 honest limitations:
 *   - visitor_events.listing_street / listing_city etc. are null for current events;
 *     address comes from listings table join or URL extraction fallback.
 *   - Long internal listing keys (e.g. "20260522215131371924000000") don't match
 *     listings."ListNumber"; address is extracted from page_url slug or shown as "Listing #ID".
 *   - No broker scope — Properties report has no agent filter (matches FUB spec).
 *   - Only site visitors are counted; CRM timeline web_events are not included here
 *     (they don't carry listing_mls-level granularity in the payload column).
 *
 * Audit query (run to verify):
 *   SELECT listing_mls, count(*) as views
 *   FROM visitor_events
 *   WHERE event_type='listing_view'
 *     AND event_at >= '<start>'
 *     AND event_at <= '<end>'
 *   GROUP BY listing_mls
 *   ORDER BY views DESC;
 */
export async function getPropertiesReport(
  params: PropertiesParams,
): Promise<PropertiesReportResult> {
  const cached = unstable_cache(
    () => readPropertiesReport(params),
    [
      'crm-properties-v1',
      params.datePreset,
      params.dateStart ?? 'none',
      params.dateEnd ?? 'none',
    ],
    { tags: ['crm-properties', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
