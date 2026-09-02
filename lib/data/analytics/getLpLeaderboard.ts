/**
 * getLpLeaderboard — which landing page converts the best, for
 * /admin/analytics/lp-leaderboard.
 *
 * Per-LP-variant aggregate: visits, identified, hot leads, conversion rate,
 * top traffic source, top city. Sourced from visitor_sessions, classified by
 * `landing_page` mapped back to its /lp/<variant> slug.
 *
 * DAL boundary (G1): raw .from() lives here. Fails soft — callers get an
 * `unreadable` flag instead of a thrown error, per §0 (an honest empty state,
 * never a silent zero presented as a real figure).
 */
import 'server-only'
import { createServiceClient } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type LpLeaderboardRow = {
  variant: string
  visits: number
  identified: number
  hot: number
  identifyRate: number
  hotRate: number
  avgScore: number
  topSource: string
  topCity: string
}

export type LpLeaderboardResult = {
  rows: LpLeaderboardRow[]
  unreadable: boolean
  errorMessage?: string
}

type LpRow = {
  variant: string
  visits: number
  identified: number
  hot: number
  scoreSum: number
  topSourceCounts: Map<string, number>
  topCityCounts: Map<string, number>
}

// Pull the LP slug out of a URL path like /lp/seller-home-value/, /lp/buyer-listing-alerts, /lp/expired-listing
// Treats /home-valuation as the seller LP also (legacy alias).
function lpVariantFromPath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  let p = pathOrUrl
  try {
    p = new URL(pathOrUrl).pathname
  } catch {
    /* already a path */
  }
  p = p.toLowerCase().replace(/\/+$/, '')
  if (p === '/home-valuation') return 'seller-home-value'
  const m = p.match(/^\/lp\/([a-z0-9-]+)/)
  if (m) return m[1]
  return null
}

function topOf(m: Map<string, number>): string {
  let best = '—'
  let bestN = 0
  for (const [k, n] of m) {
    if (n > bestN) {
      best = k
      bestN = n
    }
  }
  return best
}

export async function getLpLeaderboard({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}): Promise<LpLeaderboardResult> {
  const supabase = createServiceClient()
  const cutoff = `${startDate}T00:00:00.000Z`
  const until = `${endDate}T23:59:59.999Z`

  // Pull sessions whose first-touch landing page is an LP (or hits one of our
  // LP slugs). Paged read up to 10,000 sessions — PostgREST caps single
  // responses at 1,000 rows, so a bare .limit(10000) would silently truncate.
  const { rows: data, error } = await fetchPagedRows(
    (from, to) =>
      supabase
        .from('visitor_sessions')
        .select(
          'session_id, landing_page, utm_source, utm_medium, utm_campaign, identified_at, hot_lead_fired_at, engagement_score, ip_city',
        )
        .gte('first_seen_at', cutoff)
        .lte('first_seen_at', until)
        .order('session_id', { ascending: true })
        .range(from, to),
    10000,
  )
  if (error) {
    console.error('[getLpLeaderboard]', error.message)
    return { rows: [], unreadable: true, errorMessage: error.message }
  }

  const byVariant = new Map<string, LpRow>()
  for (const raw of data) {
    const row = raw as {
      landing_page: string | null
      utm_source: string | null
      identified_at: string | null
      hot_lead_fired_at: string | null
      engagement_score: number
      ip_city: string | null
    }
    const variant = lpVariantFromPath(row.landing_page)
    if (!variant) continue
    const r = byVariant.get(variant) ?? {
      variant,
      visits: 0,
      identified: 0,
      hot: 0,
      scoreSum: 0,
      topSourceCounts: new Map<string, number>(),
      topCityCounts: new Map<string, number>(),
    }
    r.visits += 1
    if (row.identified_at) r.identified += 1
    if (row.hot_lead_fired_at) r.hot += 1
    r.scoreSum += row.engagement_score || 0
    if (row.utm_source) r.topSourceCounts.set(row.utm_source, (r.topSourceCounts.get(row.utm_source) ?? 0) + 1)
    if (row.ip_city) r.topCityCounts.set(row.ip_city, (r.topCityCounts.get(row.ip_city) ?? 0) + 1)
    byVariant.set(variant, r)
  }

  const rows: LpLeaderboardRow[] = Array.from(byVariant.values())
    .map((r) => ({
      variant: r.variant,
      visits: r.visits,
      identified: r.identified,
      hot: r.hot,
      identifyRate: r.visits ? r.identified / r.visits : 0,
      hotRate: r.visits ? r.hot / r.visits : 0,
      avgScore: r.visits ? r.scoreSum / r.visits : 0,
      topSource: topOf(r.topSourceCounts),
      topCity: topOf(r.topCityCounts),
    }))
    .sort((a, b) => b.identifyRate - a.identifyRate)

  return { rows, unreadable: false }
}
