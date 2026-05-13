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
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300

const SOURCE = 'gbp_performance_api_v1'
const CHANNEL = 'gbp' as const

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
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

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
