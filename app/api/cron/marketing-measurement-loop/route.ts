/**
 * marketing-brain measurement-loop cron route.
 *
 * Reads executed action rows, picks the next measurement window (24h /
 * 7d / 30d) for each platform_post_id in executor_response.published_posts,
 * fetches metrics from the relevant platform API, writes one row per
 * (action, window) to public.content_performance.
 *
 * Schedule: daily 15:00 UTC (08:00 PT in summer). Runs after morning
 * snapshot ingestors so the platform metric cache is fresh.
 *
 * Manual invocation:
 *   GET /api/cron/marketing-measurement-loop
 *     ?maxCandidates=200    (default 200)
 *     &dryRun=true          (returns candidate list without writing)
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { runMeasurementLoop } from '@/lib/marketing-brain/measurement-loop'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const maxCandidatesParam = url.searchParams.get('maxCandidates')
  const dryRun = url.searchParams.get('dryRun') === 'true'

  try {
    const report = await runMeasurementLoop({
      maxCandidates: maxCandidatesParam ? Number(maxCandidatesParam) : undefined,
      dryRun,
    })
    return NextResponse.json(report)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('marketing-measurement-loop:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
