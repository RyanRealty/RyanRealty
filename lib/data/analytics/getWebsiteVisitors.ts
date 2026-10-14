/**
 * getWebsiteVisitors — who visited ryan-realty.com, from our own site tracking,
 * for the Website view of /admin/analytics (Matt 2026-10-14: one page that
 * "actually makes sense").
 *
 * Source: visitor_sessions (first-party; every visitor the tracker recorded,
 * whatever they answered on the cookie banner, minus Global Privacy Control
 * opt-outs, which the track route never stores). One paged read covers the
 * current window AND the comparison window, then everything is counted here:
 *
 *   visits             sessions whose first_seen_at falls in the window
 *   engaged visits     visits that did more than glance: engagement_score at
 *                      or above ENGAGED_SCORE_MIN, the same bar the sales
 *                      funnel's "engaged" stage uses (salesFunnelMath.ts). One
 *                      listing view scores 10, so a single-page drive-by is
 *                      never engaged; two listings, a selling page (25) or a
 *                      CTA click (20) is (visitor_score_delta_for_event).
 *   visitors           distinct browsers (rr_vid); a visit with no browser id
 *                      counts as its own visitor
 *   came back          browsers with two or more visits in the window
 *   location           ip_country / ip_region / ip_city, bucketed by
 *                      websiteGeo.ts (stored only when analytics was allowed)
 *   buying or selling  intent_tags, read by intentSplit.ts (the same reading
 *                      /admin/analytics/funnel-breakdown uses)
 *
 * Automation (is_automated: crawlers, scripts, headless browsers and the
 * brokers' own browsers) is left out of every count and reported on its own,
 * so a crawler burst can never read as a good week.
 *
 * DAL boundary (G1): the raw read lives here. Fails soft to `unreadable`, so the
 * page shows "could not read" instead of a zero (§0). Cached 10 minutes.
 */
import 'server-only'
import { unstable_cache } from '@/lib/data/cache/next-cache'
import { createServiceClient } from '@/lib/supabase/service'
import {
  GEO_BUCKET_LABEL,
  GEO_BUCKET_ORDER,
  cityKeyAndLabel,
  countryName,
  geoBucketOf,
  normalizeCountry,
  usStateCode,
  usStateName,
  type GeoBucket,
} from './websiteGeo'
import {
  INTENT_ORDER,
  INTENT_PLAIN_LABEL,
  INTENT_PLAIN_MEANING,
  classifyIntent,
  type VisitIntent,
} from './intentSplit'
import { ENGAGED_SCORE_MIN } from './salesFunnelMath'

export type WebsiteWindow = { startIso: string; endIso: string }

export type VisitorPeriod = {
  /** Visits by people (automation left out). */
  visits: number
  /** Of those, visits at or above the engaged bar (ENGAGED_SCORE_MIN). */
  engagedVisits: number
  /** Distinct browsers among those visits. */
  visitors: number
  /** Browsers with two or more visits in the window. */
  cameBack: number
  /** Visits flagged as automation and left out of the counts above. */
  automatedLeftOut: number
  /** Visits with no browser id (each counted as its own visitor). */
  withoutBrowserId: number
}

export type GeoBucketRow = { bucket: GeoBucket; label: string; visits: number; engaged: number }
export type GeoPlaceRow = { key: string; label: string; visits: number; engaged: number; bucket: GeoBucket }
export type IntentRow = { intent: VisitIntent; label: string; meaning: string; visits: number; engaged: number }

export type WebsiteVisitors = {
  current: VisitorPeriod
  previous: VisitorPeriod
  geo: {
    buckets: GeoBucketRow[]
    /** Visits that carried a location. */
    located: number
    topCities: GeoPlaceRow[]
    topStates: GeoPlaceRow[]
    topCountries: GeoPlaceRow[]
  }
  intent: IntentRow[]
  /** True when the read hit the row cap: counts are then a floor. */
  truncated: boolean
  unreadable: boolean
  errorMessage?: string
}

export type WebsiteSessionRow = {
  session_id: string
  rr_vid: string | null
  first_seen_at: string
  is_automated: boolean | null
  ip_country: string | null
  ip_region: string | null
  ip_city: string | null
  intent_tags: string[] | null
  engagement_score: number | null
}

const SELECT =
  'session_id,rr_vid,first_seen_at,is_automated,ip_country,ip_region,ip_city,intent_tags,engagement_score'
/** Two 30-day windows at today's volume sit far below this; past it the result says so. */
const ROW_CAP = 100_000

function emptyPeriod(): VisitorPeriod {
  return { visits: 0, engagedVisits: 0, visitors: 0, cameBack: 0, automatedLeftOut: 0, withoutBrowserId: 0 }
}

function emptyResult(unreadable: boolean, errorMessage?: string): WebsiteVisitors {
  return {
    current: emptyPeriod(),
    previous: emptyPeriod(),
    geo: { buckets: [], located: 0, topCities: [], topStates: [], topCountries: [] },
    intent: [],
    truncated: false,
    unreadable,
    errorMessage,
  }
}

/** At or above the funnel's engaged bar. */
export function isEngaged(r: Pick<WebsiteSessionRow, 'engagement_score'>): boolean {
  return Number(r.engagement_score ?? 0) >= ENGAGED_SCORE_MIN
}

function inWindow(at: string, w: WebsiteWindow): boolean {
  const t = Date.parse(at)
  return t >= Date.parse(w.startIso) && t <= Date.parse(w.endIso)
}

/** Count one window's visits. Exported for tests: pure. */
export function summarizePeriod(rows: readonly WebsiteSessionRow[]): VisitorPeriod {
  const p = emptyPeriod()
  const perBrowser = new Map<string, number>()
  for (const r of rows) {
    if (r.is_automated) {
      p.automatedLeftOut += 1
      continue
    }
    p.visits += 1
    if (isEngaged(r)) p.engagedVisits += 1
    const vid = r.rr_vid?.trim()
    if (!vid) {
      p.withoutBrowserId += 1
      continue
    }
    perBrowser.set(vid, (perBrowser.get(vid) ?? 0) + 1)
  }
  p.visitors = perBrowser.size + p.withoutBrowserId
  for (const n of perBrowser.values()) if (n >= 2) p.cameBack += 1
  return p
}

function topRows(m: Map<string, GeoPlaceRow>, n: number): GeoPlaceRow[] {
  return [...m.values()].sort((a, b) => b.visits - a.visits || a.label.localeCompare(b.label)).slice(0, n)
}

/** Where the window's human visits were, and what they were after. Pure. */
export function summarizeAudience(rows: readonly WebsiteSessionRow[]): Pick<WebsiteVisitors, 'geo' | 'intent'> {
  const bucketCounts = new Map<GeoBucket, { visits: number; engaged: number }>()
  const cities = new Map<string, GeoPlaceRow>()
  const states = new Map<string, GeoPlaceRow>()
  const countries = new Map<string, GeoPlaceRow>()
  const intents = new Map<VisitIntent, { visits: number; engaged: number }>()
  let located = 0

  for (const r of rows) {
    if (r.is_automated) continue
    const engaged = isEngaged(r) ? 1 : 0
    const g = { country: r.ip_country, region: r.ip_region, city: r.ip_city }
    const bucket = geoBucketOf(g)
    const b = bucketCounts.get(bucket) ?? { visits: 0, engaged: 0 }
    b.visits += 1
    b.engaged += engaged
    bucketCounts.set(bucket, b)
    const country = normalizeCountry(r.ip_country)
    if (country) located += 1

    const city = cityKeyAndLabel(g)
    if (city) {
      const row = cities.get(city.key) ?? { key: city.key, label: city.label, visits: 0, engaged: 0, bucket }
      row.visits += 1
      row.engaged += engaged
      cities.set(city.key, row)
    }
    const state = usStateCode(r.ip_country, r.ip_region)
    if (state) {
      const row = states.get(state) ?? {
        key: state,
        label: usStateName(state),
        visits: 0,
        engaged: 0,
        bucket: state === 'OR' ? 'rest_of_oregon' : 'other_states',
      }
      row.visits += 1
      row.engaged += engaged
      states.set(state, row)
    }
    if (country && country !== 'US') {
      const row = countries.get(country) ?? {
        key: country,
        label: countryName(country),
        visits: 0,
        engaged: 0,
        bucket: 'other_countries',
      }
      row.visits += 1
      row.engaged += engaged
      countries.set(country, row)
    }

    const intent = classifyIntent(r.intent_tags)
    const it = intents.get(intent) ?? { visits: 0, engaged: 0 }
    it.visits += 1
    it.engaged += engaged
    intents.set(intent, it)
  }

  return {
    geo: {
      buckets: GEO_BUCKET_ORDER.map((b) => ({
        bucket: b,
        label: GEO_BUCKET_LABEL[b],
        visits: bucketCounts.get(b)?.visits ?? 0,
        engaged: bucketCounts.get(b)?.engaged ?? 0,
      })),
      located,
      topCities: topRows(cities, 10),
      topStates: topRows(states, 8),
      topCountries: topRows(countries, 6),
    },
    intent: INTENT_ORDER.map((i) => ({
      intent: i,
      label: INTENT_PLAIN_LABEL[i],
      meaning: INTENT_PLAIN_MEANING[i],
      visits: intents.get(i)?.visits ?? 0,
      engaged: intents.get(i)?.engaged ?? 0,
    })),
  }
}

const PAGE = 1000
/** Pages fetched at once. Every page carries the same total order. */
const CONCURRENCY = 6

type Sb = ReturnType<typeof createServiceClient>

/** Exact count of sessions first seen in [startIso, endIso] with this automation flag. */
async function countSessions(sb: Sb, startIso: string, endIso: string, automated: boolean): Promise<number> {
  const { count, error } = await sb
    .from('visitor_sessions')
    .select('session_id', { count: 'exact', head: true })
    .eq('is_automated', automated)
    .gte('first_seen_at', startIso)
    .lte('first_seen_at', endIso)
  if (error) throw new Error(`visitor_sessions count failed: ${error.message}`)
  return count ?? 0
}

/**
 * Every human session first seen in [startIso, endIso]. Counted first, then
 * paged CONCURRENCY at a time. The order (first_seen_at, session_id) is total,
 * which is what keeps concurrent range() pages from duplicating or skipping
 * rows (an unordered concurrent read dropped 18% on 2026-08-03).
 */
async function readHumanSessions(sb: Sb, startIso: string, endIso: string): Promise<{ rows: WebsiteSessionRow[]; truncated: boolean }> {
  const total = await countSessions(sb, startIso, endIso, false)
  const wanted = Math.min(total, ROW_CAP)
  const offsets: number[] = []
  for (let from = 0; from < wanted; from += PAGE) offsets.push(from)
  const pages: WebsiteSessionRow[][] = new Array(offsets.length)
  for (let i = 0; i < offsets.length; i += CONCURRENCY) {
    const batch = offsets.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (from, j) => {
        const { data, error } = await sb
          .from('visitor_sessions')
          .select(SELECT)
          .eq('is_automated', false)
          .gte('first_seen_at', startIso)
          .lte('first_seen_at', endIso)
          .order('first_seen_at', { ascending: true })
          .order('session_id', { ascending: true })
          .range(from, Math.min(from + PAGE, wanted) - 1)
        if (error) throw new Error(`visitor_sessions read failed: ${error.message}`)
        pages[i + j] = (data ?? []) as WebsiteSessionRow[]
      }),
    )
  }
  return { rows: pages.flat(), truncated: total > ROW_CAP }
}

async function readWebsiteVisitors(current: WebsiteWindow, previous: WebsiteWindow): Promise<WebsiteVisitors> {
  const sb = createServiceClient()
  try {
    // Automation is counted, never fetched: it outnumbers people several to
    // one (Oct 7-13: 8,854 flagged sessions against 2,447 human ones).
    const [human, botsNow, botsBefore] = await Promise.all([
      readHumanSessions(sb, previous.startIso, current.endIso),
      countSessions(sb, current.startIso, current.endIso, true),
      countSessions(sb, previous.startIso, previous.endIso, true),
    ])
    const cur = human.rows.filter((r) => inWindow(r.first_seen_at, current))
    const prev = human.rows.filter((r) => inWindow(r.first_seen_at, previous))
    return {
      current: { ...summarizePeriod(cur), automatedLeftOut: botsNow },
      previous: { ...summarizePeriod(prev), automatedLeftOut: botsBefore },
      ...summarizeAudience(cur),
      truncated: human.truncated,
      unreadable: false,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[getWebsiteVisitors]', message)
    return emptyResult(true, message)
  }
}

export async function getWebsiteVisitors(input: {
  current: WebsiteWindow
  previous: WebsiteWindow
}): Promise<WebsiteVisitors> {
  const { current, previous } = input
  const cached = unstable_cache(
    () => readWebsiteVisitors(current, previous),
    ['website-visitors-v2', current.startIso, current.endIso, previous.startIso, previous.endIso],
    { tags: ['website-dashboard'], revalidate: 600 },
  )
  return cached()
}
