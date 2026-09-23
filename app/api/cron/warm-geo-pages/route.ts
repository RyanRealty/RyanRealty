import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { buildWarmPaths } from '@/lib/warm-geo-pages'
import { getIndexableSubdivisions } from '@/lib/data/subdivisions/getIndexableSubdivisions'
import { getTileRefreshInProgress } from '@/lib/data/mv/getTileRefreshInProgress'
import {
  PLAT_WARM_CLAIM_UNTIL_MS,
  PLAT_WARM_CONCURRENCY,
  PLAT_WARM_HARD_STOP_MS,
  platSliceLeaseName,
  platWarmPaths,
  platWarmSlices,
} from '@/lib/warm-plat-pages'

/**
 * warm-geo-pages — fill the ISR cache for the on-demand geo tail, once per
 * production deployment.
 *
 * G70 (ci:ssg-budget) moved ~125 subdivision/oregon pages off the build, and
 * the city/neighborhood pages skip heavy rails during SSG (lib/build-phase.ts)
 * — both correct trades that left one cost: after every deploy the first
 * visitor to a tail page pays the cold render, and skipped rails serve their
 * fallback until the first revalidation. This cron pays that cost itself,
 * within minutes of the deploy going live, so crawlers and users always land
 * on warm, fully-hydrated pages.
 *
 * Once-per-deploy without a new table: the generic crm_try_cron_lease named
 * lease, keyed on the running deployment's commit SHA. The first run on a new
 * deployment acquires `warm-geo-<sha>` and warms; every later run (schedule is
 * every 10 minutes) fails to acquire it and moves on to the plat tier below.
 * The lease is deliberately never released — it IS the "already warmed" marker.
 * Rows are bounded by deploy count (~4/day) and expire after 7 days.
 *
 * THE PLAT TIER (P3 — SEO-2, DATA-1, 2026-09-23). Tier 1 covers only the ~100
 * registry alias plats, while /sitemaps/geo.xml submits 2,642 plats that all
 * render cold after a deploy (2.4 to 8.6 s measured; one in four came back 500
 * at crawler concurrency 8 before lib/site/degraded-isr.ts stopped calling
 * noStore()). Every later run claims the next unclaimed slice of the indexable
 * set (lib/warm-plat-pages.ts, largest sale history first) with a lease named
 * for this deployment, warms it, and claims another while time allows. So the
 * pass is bounded per invocation, resumes where the last one stopped, and
 * fetches each plat once per deployment. It skips a run while pg_cron is
 * refreshing listing_tile_mv_src (the same probe warm-sitemaps uses): renders
 * inside that window lose their reads to the 8 s statement timeout. Each run
 * logs every 5xx it saw, which makes it the standing 5xx sweep of the plat
 * sitemap class as well.
 *
 * The fetch UA is the same string ci:probe-ua pins against middleware's
 * BAD_BOT_RE (scripts/lib/ci-probe-ua.mjs) — any middleware change that would
 * screen these warms out fails that gate first.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const WARM_UA = 'rr-ci-probe/1.0 (+https://ryan-realty.com/robots.txt)'
const CONCURRENCY = 6
const PER_REQUEST_TIMEOUT_MS = 15_000
const LEASE_SECONDS = 7 * 24 * 3600

type WarmResult = 'ok' | 'not_found' | 'server_error' | 'failed'

async function warmOne(path: string): Promise<WarmResult> {
  try {
    const res = await fetch(`${ORIGIN}${path}`, {
      headers: { 'user-agent': WARM_UA },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(PER_REQUEST_TIMEOUT_MS),
    })
    if (res.ok) return 'ok'
    if (res.status === 404) return 'not_found'
    return res.status >= 500 ? 'server_error' : 'failed'
  } catch {
    return 'failed'
  }
}

type Sb = ReturnType<typeof createServiceClient>

async function warmPlatTier(sb: Sb, sha: string, t0: number) {
  if (await getTileRefreshInProgress()) {
    return { ok: true, tier: 'plats', status: 'skipped', reason: 'listing_tile_mv_src refresh in progress (advisory lock 7101)' }
  }
  const plats = await getIndexableSubdivisions()
  if (plats.length === 0) {
    // The set's own fallback: the read did not answer. Nothing is claimed, so
    // the next run tries again.
    return { ok: true, tier: 'plats', status: 'skipped', reason: 'indexable plat set unavailable' }
  }
  const paths = platWarmPaths(plats)
  const slices = platWarmSlices(paths)

  let warmed = 0
  let notFound = 0
  let serverErrors = 0
  let failed = 0
  let fetched = 0
  let truncated = false
  const claimed: number[] = []
  const serverErrorPaths: string[] = []

  for (let k = 0; k < slices.length; k += 1) {
    if (Date.now() - t0 > PLAT_WARM_CLAIM_UNTIL_MS) break
    const { data: got } = await sb.rpc('crm_try_cron_lease', {
      p_name: platSliceLeaseName(sha, paths.length, k),
      p_lease_seconds: LEASE_SECONDS,
    })
    if (!got) continue
    claimed.push(k)
    const slice = slices[k]
    for (let i = 0; i < slice.length; i += PLAT_WARM_CONCURRENCY) {
      if (Date.now() - t0 > PLAT_WARM_HARD_STOP_MS) {
        truncated = true
        break
      }
      const batch = slice.slice(i, i + PLAT_WARM_CONCURRENCY)
      const results = await Promise.all(batch.map(warmOne))
      results.forEach((r, j) => {
        fetched += 1
        if (r === 'ok') warmed += 1
        else if (r === 'not_found') notFound += 1
        else if (r === 'server_error') {
          serverErrors += 1
          if (serverErrorPaths.length < 20) serverErrorPaths.push(batch[j])
        } else failed += 1
      })
    }
    if (truncated) break
  }

  const summary = {
    ok: !(fetched > 0 && warmed < fetched / 2),
    tier: 'plats',
    status: claimed.length === 0 ? 'skipped' : 'warmed',
    reason: claimed.length === 0 ? `every plat slice already claimed for deployment ${sha}` : undefined,
    plats: paths.length,
    slices: slices.length,
    claimed,
    fetched,
    warmed,
    not_found: notFound,
    server_errors: serverErrors,
    server_error_paths: serverErrorPaths,
    failed,
    truncated,
    ms: Date.now() - t0,
  }
  if (claimed.length > 0) {
    console.log(
      `[warm-geo-pages:plats] deployment=${sha} slices=${claimed.join(',')}/${slices.length} fetched=${fetched} ok=${warmed} 5xx=${serverErrors} failed=${failed} ${summary.ms}ms`,
    )
  }
  if (serverErrors > 0) console.error('[warm-geo-pages:plats] 5xx:', JSON.stringify(serverErrorPaths))
  return summary
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12)
  if (!sha) {
    return NextResponse.json({ ok: true, status: 'skipped', reason: 'no VERCEL_GIT_COMMIT_SHA (local/preview)' })
  }

  const t0 = Date.now()
  const sb = createServiceClient()
  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', {
    p_name: `warm-geo-${sha}`,
    p_lease_seconds: LEASE_SECONDS,
  })
  if (!gotLease) {
    // Tier 1 already ran for this deployment: spend this run on the plat tier.
    const plats = await warmPlatTier(sb, sha, t0)
    return NextResponse.json(plats, { status: plats.ok ? 200 : 500 })
  }

  const paths = await buildWarmPaths()
  let ok = 0
  let notFound = 0
  let failed = 0
  const failedPaths: string[] = []

  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    const results = await Promise.all(paths.slice(i, i + CONCURRENCY).map(warmOne))
    for (let j = 0; j < results.length; j += 1) {
      if (results[j] === 'ok') ok += 1
      else if (results[j] === 'not_found') notFound += 1
      else {
        failed += 1
        if (failedPaths.length < 20) failedPaths.push(paths[i + j])
      }
    }
  }

  // >50% failures = the warmer itself is broken (WAF drift, origin change) —
  // go red so cron monitoring surfaces it. Scattered failures are fine: those
  // pages simply warm on demand like they would without this cron.
  const broken = failed > paths.length / 2
  return NextResponse.json(
    {
      ok: !broken,
      deployment: sha,
      total: paths.length,
      warmed: ok,
      not_found: notFound,
      failed,
      failed_paths: failedPaths,
      ms: Date.now() - t0,
    },
    { status: broken ? 500 : 200 },
  )
}
