// cron: invoked-by /api/cron/snapshot-channels (fan-out caller; deliberately not in vercel.json)
/**
 * GA4 daily snapshot ingestor.
 *
 * Fetches website analytics from GA4 via getGA4Summary() and decomposes
 * the response into marketing_channel_daily rows (lib/marketing-brain/
 * ga4-snapshot-rows.ts).
 *
 * Default behavior: re-pulls a settle window, today-3..today-1, every run.
 * GA4 keeps processing a day after it ends, and the old yesterday-only pull
 * stored whatever it saw on the first try forever (visibility audit
 * 2026-09-22, TRACK-2). upsertMetricRows is keyed on the day, so a late day is
 * corrected in place — the same pattern as the GSC ingestor's today-9..today-2.
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD pulls one row per day in
 * that range, calling GA4 once per day to keep per-day attribution accurate.
 *
 * Also written each day (visibility audit 2026-09-22 / owner directive
 * 2026-09-23):
 *   - metadata.mirror_inflated=true on the rows the Measurement Protocol
 *     page-view mirror shapes (TRACK-1, lib/analytics/ga4-mirror.ts).
 *   - exact session_start / first_visit / google-organic counts, zero included.
 *   - ga4 account `tracking_health_ok` (1/0) and, once Search Console has
 *     settled, `organic_to_gsc_click_ratio_7d` — the daily guard that catches a
 *     dead browser stream in one day (lib/analytics/ga4-tracking-health.ts).
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getGA4Summary } from '@/app/actions/ga4-report'
import {
  IngestorResult,
  parseDateRange,
  readMetricSeries,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'
import { buildGa4DayRows, GA4_SNAPSHOT_SOURCE } from '@/lib/marketing-brain/ga4-snapshot-rows'
import { fetchGa4HealthCounts } from '@/lib/marketing-brain/ga4-health-counts'
import { isGa4PageViewMirrorOn } from '@/lib/analytics/ga4-mirror'
import {
  evaluateGa4TrackingHealth,
  GOOGLE_ORGANIC_SESSIONS_METRIC,
  healthRows,
  isoAddDays,
  ORGANIC_WINDOW_DAYS,
} from '@/lib/analytics/ga4-tracking-health'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const maxDuration = 300

/** today-3..today-1: the window re-pulled on every scheduled run. */
const SETTLE_WINDOW = { fromDaysAgo: 3, toDaysAgo: 1 }

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  let startDate: string
  let endDate: string
  try {
    ;({ startDate, endDate } = parseDateRange(request, SETTLE_WINDOW))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'invalid date range' },
      { status: 400 }
    )
  }

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0

  // Exact browser-only counts for the whole window in two small reports. On
  // failure the top-50 event rows still land and the health guard is skipped:
  // a guard that cannot read its inputs must not write a verdict.
  const exactCounts = await fetchGa4HealthCounts(startDate, endDate)
  if (!exactCounts.ok) errors.push(`health counts: ${exactCounts.error}`)

  const ingestedDays: string[] = []
  for (const day of dateIter(startDate, endDate)) {
    try {
      const summary = await getGA4Summary(day, day)
      if (!summary.ok) {
        errors.push(`${day}: ${summary.error}`)
        continue
      }
      const rows = buildGa4DayRows(day, summary.data, {
        mirrorOn: isGa4PageViewMirrorOn(day),
        exact: exactCounts.ok ? (exactCounts.byDate.get(day) ?? null) : null,
      })
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(r.metric))
      ingestedDays.push(day)
    } catch (e) {
      errors.push(`${day}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── daily tracking-health guard ────────────────────────────────────────
  const health: Array<{ date: string; ok: boolean; failures: string[] }> = []
  if (exactCounts.ok && ingestedDays.length > 0) {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const from = isoAddDays(ingestedDays[0], -(ORGANIC_WINDOW_DAYS - 1))
      const to = ingestedDays[ingestedDays.length - 1]
      const [ga4GoogleOrganic, gscClicks] = await Promise.all([
        readMetricSeries({ channel: 'ga4', scope: 'account', scope_id: '', metric: GOOGLE_ORGANIC_SESSIONS_METRIC, from, to }),
        readMetricSeries({ channel: 'gsc', scope: 'account', scope_id: '', metric: 'clicks', from, to }),
      ])
      for (const day of ingestedDays) {
        const counts = exactCounts.byDate.get(day)
        if (!counts) continue
        const verdict = evaluateGa4TrackingHealth({
          date: day,
          today,
          browserSessionStart: counts.sessionStart,
          browserFirstVisit: counts.firstVisit,
          ga4GoogleOrganic,
          gscClicks,
        })
        const rows = healthRows(verdict, GA4_SNAPSHOT_SOURCE)
        totalRows += await upsertMetricRows(rows)
        rows.forEach((r) => metricsCovered.add(r.metric))
        health.push({ date: day, ok: verdict.ok, failures: verdict.failures })
      }
    } catch (e) {
      errors.push(`health guard: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const result: IngestorResult & { health: typeof health } = {
    channel: 'ga4',
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
    health,
  }

  return NextResponse.json(result)
}
