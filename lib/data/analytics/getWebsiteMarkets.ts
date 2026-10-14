/**
 * getWebsiteMarkets — which markets (cities) visitors looked at on
 * ryan-realty.com, from our own site tracking, for the Website view of
 * /admin/analytics.
 *
 * Source: visitor_events page_view + listing_view rows in the window (a page
 * sends one or the other, never both: components/VisitTracker.tsx), each read
 * for its city by websiteMarkets.ts marketFromUrl. Views from sessions flagged
 * as automation (visitor_sessions.is_automated) are left out in the query, the
 * same rule getWebsiteVisitors applies, so the two cards count the same people.
 *
 * Per city: views (every page about the city), listing views, and visitors
 * (distinct sessions). Pages that carry no city (home, blog, community and
 * subdivision pages) are counted in `pageViews` but in no market.
 *
 * Searches: visitor_events 'search' rows, sent by the site's search box
 * (components/search/SearchFilters.tsx) with the typed place in
 * metadata.query. The metadata is not stored for visitors who have not allowed
 * analytics, so `searchEvents` can exceed the terms counted.
 *
 * DAL boundary (G1): the raw reads live here. Fails soft to `unreadable`.
 * Cached 10 minutes.
 */
import 'server-only'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { cityNameFromSlug, isLocalMarket, marketFromUrl } from './websiteMarkets'

export type MarketRow = {
  citySlug: string
  city: string
  /** Inside the Central Oregon service area. */
  local: boolean
  views: number
  listingViews: number
  visitors: number
}

export type SearchTermRow = { term: string; searches: number }

export type WebsiteMarkets = {
  rows: MarketRow[]
  /** What people typed in the site's search box (metadata.query), most first. */
  searches: SearchTermRow[]
  /** Search-box events in the window, including ones with no term kept. */
  searchEvents: number
  /** Every page and listing view by people in the window. */
  pageViews: number
  /** Of those, the views that named a city. */
  marketViews: number
  truncated: boolean
  unreadable: boolean
  errorMessage?: string
}

export type MarketEventRow = { session_id: string; page_url: string | null }
export type SearchEventRow = { metadata: Record<string, unknown> | null }

const EVENT_CAP = 300_000

function failed(errorMessage: string): WebsiteMarkets {
  return { rows: [], searches: [], searchEvents: 0, pageViews: 0, marketViews: 0, truncated: false, unreadable: true, errorMessage }
}

/** Count views per city. Pure; exported for tests. */
export function summarizeMarkets(
  events: readonly MarketEventRow[],
): Pick<WebsiteMarkets, 'rows' | 'pageViews' | 'marketViews'> {
  const byCity = new Map<string, { views: number; listingViews: number; sessions: Set<string> }>()
  let pageViews = 0
  let marketViews = 0
  for (const e of events) {
    pageViews += 1
    const hit = marketFromUrl(e.page_url ?? '')
    if (!hit) continue
    marketViews += 1
    const agg = byCity.get(hit.citySlug) ?? { views: 0, listingViews: 0, sessions: new Set<string>() }
    agg.views += 1
    if (hit.kind === 'listing') agg.listingViews += 1
    agg.sessions.add(e.session_id)
    byCity.set(hit.citySlug, agg)
  }
  const rows = [...byCity.entries()]
    .map(([citySlug, a]) => ({
      citySlug,
      city: cityNameFromSlug(citySlug),
      local: isLocalMarket(citySlug),
      views: a.views,
      listingViews: a.listingViews,
      visitors: a.sessions.size,
    }))
    .sort((a, b) => b.views - a.views || a.city.localeCompare(b.city))
  return { rows, pageViews, marketViews }
}

/** Top typed searches. Pure; exported for tests. */
export function summarizeSearches(events: readonly SearchEventRow[], top = 8): SearchTermRow[] {
  const counts = new Map<string, { term: string; searches: number }>()
  for (const e of events) {
    const raw = e.metadata?.query ?? e.metadata?.term
    if (typeof raw !== 'string') continue
    const term = raw.trim().replace(/\s+/g, ' ')
    if (!term) continue
    const key = term.toLowerCase()
    const row = counts.get(key) ?? { term, searches: 0 }
    row.searches += 1
    counts.set(key, row)
  }
  return [...counts.values()].sort((a, b) => b.searches - a.searches || a.term.localeCompare(b.term)).slice(0, top)
}

async function readWebsiteMarkets(startIso: string, endIso: string): Promise<WebsiteMarkets> {
  const sb = createServiceClient()
  // The inner join on the owning session (visitor_events.session_id is a
  // foreign key to visitor_sessions) drops automation in the database, so a
  // crawler's views are never fetched. Measured 2026-10-14 for Oct 7-13:
  // automation owned 8,983 of the 11,562 page and listing views.
  const events = await fetchPagedRows<MarketEventRow>(
    (from, to) =>
      sb
        .from('visitor_events')
        .select('session_id,page_url,visitor_sessions!inner(is_automated)')
        .eq('visitor_sessions.is_automated', false)
        .in('event_type', ['page_view', 'listing_view'])
        .gte('event_at', startIso)
        .lte('event_at', endIso)
        // event_at leads so the read walks the event_at index; id breaks ties
        // so range() pages are a total order.
        .order('event_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    EVENT_CAP,
  )
  if (events.error) {
    console.error('[getWebsiteMarkets]', events.error.message)
    return failed(events.error.message)
  }
  const searches = await fetchPagedRows<SearchEventRow>(
    (from, to) =>
      sb
        .from('visitor_events')
        .select('metadata,visitor_sessions!inner(is_automated)')
        .eq('visitor_sessions.is_automated', false)
        .eq('event_type', 'search')
        .gte('event_at', startIso)
        .lte('event_at', endIso)
        .order('event_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to),
    EVENT_CAP,
  )
  if (searches.error) {
    console.error('[getWebsiteMarkets] searches', searches.error.message)
    return failed(searches.error.message)
  }
  return {
    ...summarizeMarkets(events.rows),
    searches: summarizeSearches(searches.rows),
    searchEvents: searches.rows.length,
    truncated: events.rows.length >= EVENT_CAP,
    unreadable: false,
  }
}

export async function getWebsiteMarkets(input: { startIso: string; endIso: string }): Promise<WebsiteMarkets> {
  const { startIso, endIso } = input
  const cached = unstable_cache(
    () => readWebsiteMarkets(startIso, endIso),
    ['website-markets-v3', startIso, endIso],
    { tags: ['website-dashboard'], revalidate: 600 },
  )
  return cached()
}
