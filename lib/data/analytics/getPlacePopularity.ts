/**
 * getPlacePopularity — which places (cities, neighborhoods, communities,
 * subdivisions) visitors actually looked at, from first-party visitor_events
 * page views in a bounded window (Matt 2026-09-01: "what are the popular
 * subdivisions, communities — optimize off our own tracking").
 *
 * Source: visitor_events.page_url classified by route shape:
 *   /homes-for-sale/<city>/<address>                → listing view in <city>
 *   /homes-for-sale/<city>/<subdivision>/<address>  → listing view in <subdivision>
 *   /subdivisions/<slug>                            → subdivision page
 *   /communities/<slug>                             → community page
 *   /cities/<city>                                  → city page
 *   /cities/<city>/<neighborhood>                   → neighborhood page
 *
 * Figures are event counts and distinct-session counts over the fetched
 * window — the read pages until a short page and stops hard at CAP rows, and
 * the result says when the cap truncated it (§0: a capped read must never
 * present itself as the whole window).
 *
 * DAL boundary (G1): raw .from() lives here. Fails soft to an unreadable flag.
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'

export type PlaceKind = 'city' | 'neighborhood' | 'community' | 'subdivision'

export type PlacePopularityRow = {
  kind: PlaceKind
  /** URL slug exactly as browsed (display prettifies; joins use this). */
  slug: string
  /** City slug context for subdivisions/neighborhoods when the URL carries one. */
  citySlug: string | null
  /** Place-page views (the hub page itself). */
  placeViews: number
  /** Listing detail views attributed to the place via the URL. */
  listingViews: number
  /** Distinct sessions across both. */
  sessions: number
}

export type PlacePopularityResult = {
  rows: PlacePopularityRow[]
  /** Total page-view events scanned in the window. */
  scanned: number
  /** True when the CAP truncated the window — counts are then a floor. */
  truncated: boolean
  unreadable: boolean
}

const PAGE = 1000
const CAP = 60_000

type Agg = {
  kind: PlaceKind
  slug: string
  citySlug: string | null
  placeViews: number
  listingViews: number
  sessions: Set<string>
}

function classify(path: string): { key: string; kind: PlaceKind; slug: string; citySlug: string | null; isListing: boolean } | null {
  const segs = path.toLowerCase().split('/').filter(Boolean)
  if (segs.length === 0) return null
  const head = segs[0]
  if (head === 'homes-for-sale') {
    // /homes-for-sale/<city>/<address> or /homes-for-sale/<city>/<subdivision>/<address>
    if (segs.length === 3) {
      return { key: `city:${segs[1]}`, kind: 'city', slug: segs[1], citySlug: null, isListing: true }
    }
    if (segs.length === 4) {
      return { key: `subdivision:${segs[1]}/${segs[2]}`, kind: 'subdivision', slug: segs[2], citySlug: segs[1], isListing: true }
    }
    return null
  }
  if (head === 'subdivisions' && segs.length === 2) {
    return { key: `subdivision:${segs[1]}`, kind: 'subdivision', slug: segs[1], citySlug: null, isListing: false }
  }
  if (head === 'communities' && segs.length === 2) {
    return { key: `community:${segs[1]}`, kind: 'community', slug: segs[1], citySlug: null, isListing: false }
  }
  if (head === 'cities') {
    if (segs.length === 2) return { key: `city:${segs[1]}`, kind: 'city', slug: segs[1], citySlug: null, isListing: false }
    if (segs.length === 3)
      return { key: `neighborhood:${segs[1]}/${segs[2]}`, kind: 'neighborhood', slug: segs[2], citySlug: segs[1], isListing: false }
  }
  return null
}

export async function getPlacePopularity(opts?: {
  windowDays?: number
}): Promise<PlacePopularityResult> {
  const windowDays = Math.min(Math.max(opts?.windowDays ?? 30, 1), 365)
  const cutoffIso = new Date(Date.now() - windowDays * 24 * 3600e3).toISOString()
  const sb = createServiceClient()

  const byKey = new Map<string, Agg>()
  let scanned = 0
  let truncated = false

  for (let from = 0; from < CAP; from += PAGE) {
    const { data, error } = await sb
      .from('visitor_events')
      .select('page_url,session_id')
      .in('event_type', ['page_view', 'listing_view'])
      .gte('event_at', cutoffIso)
      .order('event_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[getPlacePopularity]', error.message)
      return { rows: [], scanned, truncated, unreadable: true }
    }
    const page = (data ?? []) as Array<{ page_url: string | null; session_id: string | null }>
    for (const r of page) {
      const raw = r.page_url ?? ''
      let path = raw
      if (raw.startsWith('http')) {
        try {
          path = new URL(raw).pathname
        } catch {
          path = raw
        }
      }
      scanned += 1
      const hit = classify(path)
      if (!hit) continue
      const agg =
        byKey.get(hit.key) ??
        ({ kind: hit.kind, slug: hit.slug, citySlug: hit.citySlug, placeViews: 0, listingViews: 0, sessions: new Set() } as Agg)
      if (hit.isListing) agg.listingViews += 1
      else agg.placeViews += 1
      if (r.session_id) agg.sessions.add(r.session_id)
      byKey.set(hit.key, agg)
    }
    if (page.length < PAGE) break
    if (from + PAGE >= CAP) truncated = true
  }

  const rows = [...byKey.values()]
    .map((a) => ({
      kind: a.kind,
      slug: a.slug,
      citySlug: a.citySlug,
      placeViews: a.placeViews,
      listingViews: a.listingViews,
      sessions: a.sessions.size,
    }))
    .sort((a, b) => b.placeViews + b.listingViews - (a.placeViews + a.listingViews))

  return { rows, scanned, truncated, unreadable: false }
}
