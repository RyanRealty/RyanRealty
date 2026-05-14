/**
 * Competitor recon cron route.
 *
 * Schedule (post-2026-05-14):
 *   Daily 07:00 UTC, Mon-Fri. Each day scrapes ONE source across all
 *   competitor targets. Splitting the 5-source × 10-competitor full pass
 *   into per-day slices keeps each invocation under the Vercel maxDuration
 *   (800s on Pro) — a full single-source pass is ~5-10 min vs ~30-60 min
 *   for all five sources together. Source picked by day-of-week:
 *     Mon → google_maps_reviews
 *     Tue → google_serp
 *     Wed → instagram_profile
 *     Thu → tiktok_profile
 *     Fri → fb_ad_library
 *   Sat/Sun → no-op (cron unscheduled).
 *
 * Vercel cron requests carry an `x-vercel-cron: 1` header and no query
 * params; the route detects that and triggers day-rotation. Manual
 * invocations (without that header) honor whatever filters are passed
 * and otherwise run the full pass (which may time out on Pro plans —
 * recommended to pass `?source=` for manual full-target runs).
 *
 * Scope filters (for targeted testing):
 *   ?source=google_maps_reviews  — run one source across all competitors
 *   ?competitor=compass_bend     — run all sources for one competitor
 *   Both together to run a single combination.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import {
  CompetitorSlug,
  CompetitorSource,
  CompetitorTarget,
  getCompetitorTargets,
  scrapeFacebookAdLibrary,
  scrapeGoogleMapsReviews,
  scrapeGoogleSerp,
  scrapeInstagramProfile,
  scrapeTikTokProfile,
} from '@/lib/marketing-brain/competitor-recon'

export const maxDuration = 800

type SourceKey = CompetitorSource

interface SourceResult {
  source: SourceKey
  competitor: CompetitorSlug
  rowsInserted: number
  runId: string
  error?: string
}

type ScraperFn = (
  target: CompetitorTarget,
  observationDate: string,
) => Promise<{ rowsInserted: number; runId: string; error?: string }>

const SCRAPERS: Record<SourceKey, ScraperFn> = {
  google_maps_reviews: scrapeGoogleMapsReviews,
  google_serp: scrapeGoogleSerp,
  instagram_profile: scrapeInstagramProfile,
  tiktok_profile: scrapeTikTokProfile,
  fb_ad_library: scrapeFacebookAdLibrary,
}

const ALL_SOURCES: SourceKey[] = [
  'google_maps_reviews',
  'google_serp',
  'instagram_profile',
  'tiktok_profile',
  'fb_ad_library',
]

/**
 * Day-of-week → source. Vercel cron requests rotate through one source
 * per weekday so each invocation completes well under maxDuration.
 * Saturday/Sunday return null (cron not scheduled; manual runs allowed).
 */
function sourceForDayOfWeek(dayOfWeekUTC: number): SourceKey | null {
  switch (dayOfWeekUTC) {
    case 1: return 'google_maps_reviews' // Monday
    case 2: return 'google_serp'          // Tuesday
    case 3: return 'instagram_profile'    // Wednesday
    case 4: return 'tiktok_profile'       // Thursday
    case 5: return 'fb_ad_library'        // Friday
    default: return null                  // Sat/Sun — no auto-run
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const sourceFilter = url.searchParams.get('source') as SourceKey | null
  const competitorFilter = url.searchParams.get('competitor') as CompetitorSlug | null
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'

  // Validate filters if provided
  if (sourceFilter && !ALL_SOURCES.includes(sourceFilter)) {
    return NextResponse.json(
      { error: `unknown source "${sourceFilter}". Valid: ${ALL_SOURCES.join(', ')}` },
      { status: 400 },
    )
  }

  const observationDate = new Date().toISOString().slice(0, 10)
  const allTargets = getCompetitorTargets()

  const targets = competitorFilter
    ? allTargets.filter((t) => t.slug === competitorFilter)
    : allTargets

  if (competitorFilter && targets.length === 0) {
    return NextResponse.json(
      { error: `unknown competitor slug "${competitorFilter}"` },
      { status: 400 },
    )
  }

  // Source selection — three modes:
  //   1. explicit ?source=X — use that single source
  //   2. no filter, Vercel cron — rotate by day-of-week (single source per run)
  //   3. no filter, manual call — run all sources (may exceed maxDuration)
  let sources: SourceKey[]
  if (sourceFilter) {
    sources = [sourceFilter]
  } else if (isVercelCron) {
    const dayUTC = new Date().getUTCDay()
    const rotatedSource = sourceForDayOfWeek(dayUTC)
    if (!rotatedSource) {
      return NextResponse.json({
        observationDate,
        skipped: true,
        reason: `Vercel cron fired on day-of-week ${dayUTC} (Sat/Sun); recon rotation runs Mon-Fri only.`,
        fetchedAt: new Date().toISOString(),
      })
    }
    sources = [rotatedSource]
  } else {
    sources = ALL_SOURCES
  }
  const results: SourceResult[] = []

  // Run serially to avoid hammering Apify and Supabase concurrently.
  // Each Apify actor call already polls to completion internally (~seconds to
  // a few minutes per run). Total wall time for full pass: ~30–60 min. The
  // route maxDuration is 300s which covers targeted single-competitor runs.
  // For full passes the cron budget allows longer execution on Vercel Pro.
  for (const source of sources) {
    const scraper = SCRAPERS[source]
    for (const target of targets) {
      try {
        const r = await scraper(target, observationDate)
        results.push({
          source,
          competitor: target.slug,
          rowsInserted: r.rowsInserted,
          runId: r.runId,
          error: r.error,
        })
      } catch (e) {
        results.push({
          source,
          competitor: target.slug,
          rowsInserted: 0,
          runId: '',
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  // Summarize
  const totalRows = results.reduce((s, r) => s + r.rowsInserted, 0)
  const errors = results.filter((r) => r.error).map((r) => `${r.source}/${r.competitor}: ${r.error}`)
  const bySource: Record<string, { rowsInserted: number; competitors: number }> = {}
  for (const r of results) {
    if (!bySource[r.source]) bySource[r.source] = { rowsInserted: 0, competitors: 0 }
    bySource[r.source].rowsInserted += r.rowsInserted
    bySource[r.source].competitors += 1
  }

  return NextResponse.json({
    observationDate,
    totalRowsInserted: totalRows,
    sourceSummary: bySource,
    errors,
    apifyRunIds: results.filter((r) => r.runId).map((r) => ({ source: r.source, competitor: r.competitor, runId: r.runId })),
    fetchedAt: new Date().toISOString(),
  })
}
