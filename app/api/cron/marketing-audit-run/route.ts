/**
 * marketing-brain audit-run cron route.
 *
 * Triggers a full competitive audit cycle: scrape (via Apify) ->
 * classify (via Anthropic) -> aggregate winners -> write the
 * analyze:audit_findings action row + markdown report.
 *
 * Manual invocation:
 *   GET /api/cron/marketing-audit-run
 *     ?auditId=YYYY-MM-DD         (optional; defaults to today UTC)
 *     &windowDays=180             (optional; defaults to competitors.json default)
 *     &maxPostsPerPlatform=200    (optional)
 *     &rebuildOnly=true           (skip scrape + classifier; only rebuild findings)
 *     &dryRun=true                (no DB writes; return would-be payload)
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 *
 * Cost: a full run is roughly $30-80 Apify + ~$18 Anthropic per
 * marketing_brain_skills/tools_registry/apify/SKILL.md cost model.
 * The route is unscheduled today; trigger manually for the first run,
 * then add a quarterly schedule to vercel.json once stable.
 *
 * Cron timeout: 800s to accommodate scrape + classifier serialization.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { runAudit } from '@/lib/marketing-brain/audit-run'

export const maxDuration = 800

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const auditId = url.searchParams.get('auditId')?.trim() || undefined
  const windowDaysParam = url.searchParams.get('windowDays')?.trim()
  const maxPostsParam = url.searchParams.get('maxPostsPerPlatform')?.trim()
  const rebuildOnly = url.searchParams.get('rebuildOnly') === 'true'
  const dryRun = url.searchParams.get('dryRun') === 'true'

  try {
    const report = await runAudit({
      auditId,
      windowDays: windowDaysParam ? Number(windowDaysParam) : undefined,
      maxPostsPerPlatform: maxPostsParam ? Number(maxPostsParam) : undefined,
      rebuildOnly,
      dryRun,
    })
    return NextResponse.json(report)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('marketing-audit-run:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
