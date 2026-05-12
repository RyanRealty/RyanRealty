/**
 * marketing-brain: generate-briefs HTTP endpoint.
 *
 * Runs the full brief-generation pipeline for a given date window and returns
 * the GeneratedBrief[] array as JSON. Auth: Authorization: Bearer $CRON_SECRET.
 *
 * Query params:
 *   asOfDate   - optional YYYY-MM-DD. Defaults to yesterday UTC.
 *   dryRun     - optional 'true'. When true, returns briefs without DB writes.
 *   maxBriefs  - optional integer 1-50. Defaults to 10.
 *
 * Returns GeneratedBrief[] as JSON.
 *
 * This endpoint is intended to be called by the weekly marketing-brain cron
 * (app/api/cron/marketing-brain-weekly or equivalent) and can also be called
 * ad hoc with dryRun=true for analysis passes without side effects.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { generateWeeklyBriefs } from '@/lib/marketing-brain/generate-briefs'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)

  // Resolve asOfDate — explicit param or yesterday UTC
  let asOfDate: string
  const asOfParam = url.searchParams.get('asOfDate')?.trim()
  if (asOfParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfParam)) {
      return NextResponse.json({ error: 'asOfDate must be YYYY-MM-DD' }, { status: 400 })
    }
    asOfDate = asOfParam
  } else {
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    asOfDate = yesterday.toISOString().slice(0, 10)
  }

  // Resolve dryRun
  const dryRun = url.searchParams.get('dryRun')?.trim() === 'true'

  // Resolve maxBriefs
  let maxBriefs = 10
  const maxParam = url.searchParams.get('maxBriefs')?.trim()
  if (maxParam) {
    const parsed = parseInt(maxParam, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 50) {
      return NextResponse.json({ error: 'maxBriefs must be an integer between 1 and 50' }, { status: 400 })
    }
    maxBriefs = parsed
  }

  try {
    const briefs = await generateWeeklyBriefs(asOfDate, { dryRun, maxBriefs })
    return NextResponse.json({
      asOfDate,
      dryRun,
      count: briefs.length,
      briefs,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }
}
