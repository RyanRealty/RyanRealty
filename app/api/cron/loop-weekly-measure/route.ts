/**
 * /api/cron/loop-weekly-measure — THE LOOP's measurer, weekly, in the cloud.
 *
 * Visibility audit 2026-09-22 (PROCESS-1, PROCESS-2, TRACK-5, TRACK-11,
 * gsc-trend-1, gsc-trend-2): the measurer ran only when a session remembered
 * to, and the ranking seeder ran only from one Mac LaunchAgent, so a slide in
 * Search Console never became work on its own. Every Monday this route:
 *
 *   1. pulls GSC page x date and query x page x date for settled days
 *      (rowLimit 25,000, startRow paging) into gsc_page_daily /
 *      gsc_query_page_daily, each row stamped with its page class;
 *   2. closes due site_improvement_ledger windows through the Learn step;
 *   3. collects the company scoreboard (collectCompanyScoreboardSignals),
 *      whose GSC status is now the page-class trend;
 *   4. inserts the ranking seeder's GSC-gap SITE nodes, plus one node per
 *      degraded money class, as open nodes deduped against the graph;
 *   5. records one loop_scoreboard_snapshots row for the boot brief.
 *
 * Tables come from supabase/migrations/20260923150000_gsc_full_store_loop_measurer.sql.
 * Until that migration is applied the store and snapshot steps report
 * "missing" and skip; seeding and Learn still run.
 *
 * Schedule: Mondays 13:00 UTC (vercel.json). Auth: Authorization: Bearer ${CRON_SECRET}.
 * Manual:   GET /api/cron/loop-weekly-measure?dryRun=1          (reads only)
 *           GET ...?steps=store&startDate=2025-06-01&endDate=2025-09-28   (backfill, 120 days per call)
 */
import { NextResponse } from 'next/server'

import { requireCronAuth } from '@/lib/auth/cron-auth'
import { createGscQuery, isIsoDate } from '@/lib/data/loop/gsc-api'
import { runWeeklyMeasure, type WeeklyMeasureSteps } from '@/lib/data/loop/weekly-measure'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const STEP_NAMES: Array<keyof WeeklyMeasureSteps> = ['store', 'learn', 'seed', 'snapshot']

function parseSteps(raw: string | null): Partial<WeeklyMeasureSteps> | undefined {
  if (!raw?.trim()) return undefined
  const wanted = new Set(raw.split(',').map((s) => s.trim()))
  return Object.fromEntries(STEP_NAMES.map((s) => [s, wanted.has(s)])) as Partial<WeeklyMeasureSteps>
}

export async function GET(req: Request) {
  const denied = requireCronAuth(req)
  if (denied) return denied

  const sp = new URL(req.url).searchParams
  const startDate = sp.get('startDate')
  const endDate = sp.get('endDate')
  if ((startDate || endDate) && !(isIsoDate(startDate) && isIsoDate(endDate) && startDate <= endDate)) {
    return NextResponse.json({ error: 'startDate and endDate must both be YYYY-MM-DD, start <= end' }, { status: 400 })
  }

  try {
    const result = await runWeeklyMeasure(
      { sb: createServiceClient(), gsc: await createGscQuery() },
      {
        now: new Date(),
        dryRun: sp.get('dryRun') === '1',
        steps: parseSteps(sp.get('steps')),
        storeRange: startDate && endDate ? { startDate, endDate } : null,
        source: 'cron:loop-weekly-measure',
      },
    )
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
