// cron: invoked-by /api/cron/snapshot-channels (fan-out caller; deliberately not in vercel.json)
/**
 * GBP daily-metrics snapshot ingestor.
 *
 * Fetches location performance data from the Google Business Profile
 * Performance API (businessprofileperformance.locations.getDailyMetricsTimeSeries)
 * and writes one marketing_channel_daily row per (date, metric) pair.
 *
 * The Insights API was deprecated in 2024. This uses the replacement v1
 * Performance API. No additional API key is required — uses the same OAuth
 * access token stored in google_business_profile_auth.
 *
 * API quota: 5,000 requests/project/day (GCP Console). Each call to this
 * cron uses 9 requests (one per metric). Running daily leaves 4,991 headroom.
 *
 * Default behavior: pulls yesterday only (for the daily Vercel cron at 06:30).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD fetches the full range
 * in a single batch (the Performance API supports multi-day ranges natively).
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 *
 * TODO: Review ingestion (own_reviews table) is not handled here. Ryan Realty
 * owns 23+ first-party reviews. A separate ingestor should write to an
 * own_reviews table pulling from the Apify Google Maps Reviews scraper or
 * the Business Profile API /reviews endpoint — same OAuth token, different
 * endpoint. Track as a future marketing-brain deliverable.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getGBPDailyMetrics, GBPDailyMetric } from '@/lib/google-business-profile'
import {
  IngestorResult,
  MetricRow,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'
import { requireCronAuth } from '@/lib/auth/cron-auth'

export const maxDuration = 300

const SOURCE = 'gbp_performance_api_v1'
const CHANNEL = 'gbp' as const

/**
 * How far back a default run re-pulls. Google's daily performance metrics are
 * computed with a lag — measured 2026-08-26, Aug 21 had a value and Aug 22-26
 * did not — so a window narrower than the lag collects nothing, forever. Ten
 * days covers the observed five with room for a slow week.
 */
const GBP_REPORTING_LAG_DAYS = 10

/**
 * Maps a GBP API metric enum to the snake_case metric name stored in
 * marketing_channel_daily. All metrics are at account scope (scope='account',
 * scope_id='') because the Performance API returns location-level aggregates.
 */
const METRIC_NAME_MAP: Record<GBPDailyMetric, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'business_impressions_desktop_maps',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'business_impressions_desktop_search',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'business_impressions_mobile_maps',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'business_impressions_mobile_search',
  CALL_CLICKS: 'call_clicks',
  WEBSITE_CLICKS: 'website_clicks',
  BUSINESS_DIRECTION_REQUESTS: 'business_direction_requests',
  BUSINESS_CONVERSATIONS: 'business_conversations',
  BUSINESS_BOOKINGS: 'business_bookings',
}

export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request)
  if (denied) return denied

  let startDate: string
  let endDate: string
  try {
    ;({ startDate, endDate } = parseDateRange(request))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'invalid date range' },
      { status: 400 }
    )
  }

  // Google's performance data lands roughly five days late: asking for
  // yesterday returns a dated entry with no value at all. The daily cron did
  // exactly that, every day, so every GBP row it ever wrote was a placeholder
  // and the real numbers were never collected — the lag window had already
  // moved on by the next run.
  //
  // So a default (unparameterised) run re-pulls a trailing window instead of
  // one day. Upsert makes it idempotent: a day that was unread stays absent
  // until Google computes it, then fills in on a later run. An explicit
  // ?startDate/&endDate is honoured as given, for backfills.
  const explicitRange = request.nextUrl.searchParams.has('startDate')
  if (!explicitRange) {
    const lagStart = new Date(Date.now() - GBP_REPORTING_LAG_DAYS * 86400_000)
    startDate = lagStart.toISOString().slice(0, 10)
  }

  // The Performance API natively supports multi-day ranges in a single call,
  // so we pass the full range rather than looping day-by-day (unlike GA4).
  const gbpResult = await getGBPDailyMetrics(startDate, endDate)

  if (!gbpResult.ok) {
    const result: IngestorResult = {
      channel: CHANNEL,
      startDate,
      endDate,
      rowsUpserted: 0,
      metricsCovered: [],
      errors: [gbpResult.error],
      fetchedAt: new Date().toISOString(),
    }
    return NextResponse.json(result, { status: 502 })
  }

  // Decompose into MetricRow tuples. All GBP location metrics are account-
  // scoped (the API is already filtered to one location via LOCATION_ID).
  const rows: MetricRow[] = gbpResult.points
    .filter((p) => p.metric in METRIC_NAME_MAP)
    .map((p) => ({
      date: p.date,
      channel: CHANNEL,
      scope: 'account',
      scope_id: '',
      metric: METRIC_NAME_MAP[p.metric],
      value: p.value,
      source: SOURCE,
      metadata: {
        gbp_metric_enum: p.metric,
        location_name: gbpResult.locationName,
      },
    }))

  const errors: string[] = []
  let totalRows = 0

  try {
    totalRows = await upsertMetricRows(rows)
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  const metricsCovered = [...new Set(rows.map((r) => r.metric))]

  const result: IngestorResult = {
    channel: CHANNEL,
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered,
    errors,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
