/**
 * Platform trends cron route.
 *
 * Runs weekly (Mondays 08:00 UTC, after marketing-competitor-recon) via
 * Vercel cron. Scrapes industry sources for algorithm changes, format
 * trends, trending audio, and relevant hashtags. Writes each signal as a
 * row to public.competitor_intel and returns a summary.
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import {
  gatherPlatformTrends,
  persistTrendsReport,
  recordTrendCheckSkipped,
} from '@/lib/marketing-brain/platform-trends'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const asOfDate = new Date().toISOString().slice(0, 10)

  // Guard: APIFY_API_TOKEN must be present. Fail clearly and log the skip.
  if (!process.env.APIFY_API_TOKEN) {
    try {
      await recordTrendCheckSkipped(asOfDate, 'APIFY_API_TOKEN is not set')
    } catch {
      // Best-effort — don't let the log write mask the primary error message
    }
    return NextResponse.json(
      {
        error:
          'APIFY_API_TOKEN is not set. Add it from apify.com/account/integrations to Vercel env.',
        skipped: true,
        asOfDate,
      },
      { status: 500 },
    )
  }

  let rowsInserted = 0
  const fetchErrors: string[] = []

  try {
    const report = await gatherPlatformTrends(asOfDate)

    // Accumulate non-fatal scrape errors for the response summary
    fetchErrors.push(...report.errors)

    rowsInserted = await persistTrendsReport(report, asOfDate)

    return NextResponse.json({
      asOfDate,
      rowsInserted,
      signalCounts: {
        algorithm_signals: report.algorithm_signals.length,
        format_trends: report.format_trends.length,
        audio_trends: report.audio_trends.length,
        hashtag_trends: report.hashtag_trends.length,
      },
      adaptations: {
        act_on: report.ryan_realty_adaptations.act_on.length,
        monitor: report.ryan_realty_adaptations.monitor.length,
        skip: report.ryan_realty_adaptations.skip.length,
      },
      scrapeErrors: fetchErrors,
      fetchedAt: report.fetched_at,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        error: message,
        asOfDate,
        rowsInserted,
        scrapeErrors: fetchErrors,
      },
      { status: 500 },
    )
  }
}
