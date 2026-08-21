import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { buildWarmPaths } from '@/lib/warm-geo-pages'

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
 * every 10 minutes) fails to acquire and no-ops. The lease is deliberately
 * never released — it IS the "already warmed" marker. Rows are bounded by
 * deploy count (~4/day) and expire after 7 days.
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

async function warmOne(path: string): Promise<'ok' | 'not_found' | 'failed'> {
  try {
    const res = await fetch(`${ORIGIN}${path}`, {
      headers: { 'user-agent': WARM_UA },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(PER_REQUEST_TIMEOUT_MS),
    })
    if (res.ok) return 'ok'
    return res.status === 404 ? 'not_found' : 'failed'
  } catch {
    return 'failed'
  }
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 12)
  if (!sha) {
    return NextResponse.json({ ok: true, status: 'skipped', reason: 'no VERCEL_GIT_COMMIT_SHA (local/preview)' })
  }

  const sb = createServiceClient()
  const { data: gotLease } = await sb.rpc('crm_try_cron_lease', {
    p_name: `warm-geo-${sha}`,
    p_lease_seconds: 7 * 24 * 3600,
  })
  if (!gotLease) {
    return NextResponse.json({ ok: true, status: 'skipped', reason: `deployment ${sha} already warmed` })
  }

  const t0 = Date.now()
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
