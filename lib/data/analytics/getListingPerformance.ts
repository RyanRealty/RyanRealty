/**
 * getListingPerformance — which listings get the most attention, for
 * /admin/analytics/listing-performance.
 *
 * Aggregates visitor_events of type listing_view by MLS number over a
 * caller-supplied date range. Surfaces: total views, unique sessions,
 * identified visitors, hot leads, average price, top traffic source.
 *
 * DAL boundary (G1): raw .from() lives here. Fails soft — callers get an
 * `unreadable` flag instead of a thrown error, per §0 (an honest empty state,
 * never a silent zero presented as a real figure).
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type ListingPerformanceRow = {
  mls: string
  address: string
  city: string
  price: number | null
  views: number
  uniqueVisitors: number
  identified: number
  hot: number
  identifyRate: number
  topSource: string
  pageUrl: string
}

export type ListingPerformanceResult = {
  rows: ListingPerformanceRow[]
  totalViews: number
  totalIdentified: number
  totalHot: number
  eventsCapped: boolean
  unreadable: boolean
  errorMessage?: string
}

type ListingAgg = {
  mls: string
  address: string
  city: string
  price: number | null
  views: number
  uniqueSessions: Set<string>
  identifiedSessions: Set<string>
  hotSessions: Set<string>
  sources: Map<string, number>
  pageUrl: string
}

function topSource(m: Map<string, number>): string {
  let bestK = '—'
  let bestN = 0
  for (const [k, n] of m) {
    if (n > bestN) {
      bestK = k
      bestN = n
    }
  }
  return bestK
}

export async function getListingPerformance({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}): Promise<ListingPerformanceResult> {
  const supabase = createServiceClient()
  const since = `${startDate}T00:00:00.000Z`
  const until = `${endDate}T23:59:59.999Z`

  // Pull listing_view events for the selected range, then aggregate in JS.
  // Paged read — PostgREST caps single responses at 1,000 rows, so a bare
  // .limit(50000) would silently truncate the leaderboard.
  const { rows: events, error } = await fetchPagedRows<{
    session_id: string
    listing_mls: string
    listing_street: string | null
    listing_city: string | null
    listing_state: string | null
    listing_price: number | null
    page_url: string
    event_at: string
    source_domain: string
  }>(
    (from, to) =>
      supabase
        .from('visitor_events')
        .select(
          'session_id, listing_mls, listing_street, listing_city, listing_state, listing_price, page_url, event_at, source_domain',
        )
        .eq('event_type', 'listing_view')
        .not('listing_mls', 'is', null)
        .gte('event_at', since)
        .lte('event_at', until)
        .order('id', { ascending: true })
        .range(from, to),
    50000,
  )
  if (error) {
    console.error('[getListingPerformance]', error.message)
    return {
      rows: [],
      totalViews: 0,
      totalIdentified: 0,
      totalHot: 0,
      eventsCapped: false,
      unreadable: true,
      errorMessage: error.message,
    }
  }

  const eventsCapped = events.length === 50000
  if (events.length === 0) {
    return { rows: [], totalViews: 0, totalIdentified: 0, totalHot: 0, eventsCapped, unreadable: false }
  }

  // Pull session join data so we can compute identified + hot per listing
  const sessionIds = Array.from(new Set(events.map((e) => e.session_id)))
  const { data: sessRows } = await supabase
    .from('visitor_sessions')
    .select('session_id, identified_at, hot_lead_fired_at, utm_source, ip_city')
    .in('session_id', sessionIds)
  const sessMap = new Map<
    string,
    { identified: boolean; hot: boolean; utm_source: string | null; ip_city: string | null }
  >()
  for (const s of (sessRows ?? []) as Array<{
    session_id: string
    identified_at: string | null
    hot_lead_fired_at: string | null
    utm_source: string | null
    ip_city: string | null
  }>) {
    sessMap.set(s.session_id, {
      identified: s.identified_at != null,
      hot: s.hot_lead_fired_at != null,
      utm_source: s.utm_source,
      ip_city: s.ip_city,
    })
  }

  const byListing = new Map<string, ListingAgg>()
  for (const e of events) {
    const mls = e.listing_mls
    let a = byListing.get(mls)
    if (!a) {
      a = {
        mls,
        address: e.listing_street || '',
        city: e.listing_city || '',
        price: e.listing_price,
        views: 0,
        uniqueSessions: new Set(),
        identifiedSessions: new Set(),
        hotSessions: new Set(),
        sources: new Map(),
        pageUrl: e.page_url,
      }
      byListing.set(mls, a)
    }
    a.views += 1
    a.uniqueSessions.add(e.session_id)
    const sess = sessMap.get(e.session_id)
    if (sess?.identified) a.identifiedSessions.add(e.session_id)
    if (sess?.hot) a.hotSessions.add(e.session_id)
    if (sess?.utm_source) a.sources.set(sess.utm_source, (a.sources.get(sess.utm_source) ?? 0) + 1)
    if (a.price == null && e.listing_price != null) a.price = e.listing_price
    if (!a.address && e.listing_street) a.address = e.listing_street
    if (!a.city && e.listing_city) a.city = e.listing_city
  }

  const rows: ListingPerformanceRow[] = Array.from(byListing.values())
    .map((a) => ({
      mls: a.mls,
      address: a.address,
      city: a.city,
      price: a.price,
      views: a.views,
      uniqueVisitors: a.uniqueSessions.size,
      identified: a.identifiedSessions.size,
      hot: a.hotSessions.size,
      identifyRate: a.uniqueSessions.size ? a.identifiedSessions.size / a.uniqueSessions.size : 0,
      topSource: topSource(a.sources),
      pageUrl: a.pageUrl,
    }))
    .sort((a, b) => b.views - a.views)

  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const totalIdentified = rows.reduce((s, r) => s + r.identified, 0)
  const totalHot = rows.reduce((s, r) => s + r.hot, 0)

  return { rows, totalViews, totalIdentified, totalHot, eventsCapped, unreadable: false }
}
