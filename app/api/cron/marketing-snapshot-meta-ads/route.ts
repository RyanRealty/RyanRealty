/**
 * Meta Ads daily snapshot ingestor.
 *
 * Fetches paid-ad performance from the Meta Ads Insights API via
 * getMetaAdsInsights() and decomposes the response into marketing_channel_daily
 * rows at both account scope (channel-wide totals) and campaign scope (one
 * row-set per campaign).
 *
 * Default behavior: pulls yesterday only (for the daily Vercel cron).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD pulls one request per
 * day to keep per-day attribution accurate.
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 *
 * Env vars required:
 *   META_PAGE_ACCESS_TOKEN (or META_PAGE_TOKEN) — long-lived page access token
 *   META_AD_ACCOUNT_ID                          — "act_<id>" or bare numeric ID
 */
import { NextRequest, NextResponse } from 'next/server'
import { getMetaAdsInsights, MetaAdsInsightRow } from '@/lib/meta-graph'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300

const CHANNEL = 'meta_ads' as const
const SOURCE = 'meta_ads_insights_api'

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

/**
 * Sum the `actions` array for a given action_type prefix.
 * The Insights API returns lead conversions as action_type="lead" and
 * purchase conversions as "offsite_conversion.fb_pixel_purchase".
 * We sum both to produce a single `conversions` metric that covers leads +
 * purchases — matching the brief's definition of "sum of leads + purchases".
 */
function sumActions(row: MetaAdsInsightRow, ...actionTypes: string[]): number {
  if (!row.actions) return 0
  return row.actions
    .filter((a) => actionTypes.some((t) => a.action_type === t))
    .reduce((acc, a) => acc + parseFloat(a.value || '0'), 0)
}

/** Parse a numeric string field, returning 0 if missing or NaN. */
function num(v: string | undefined): number {
  if (!v) return 0
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

function accountRowsForDay(date: string, row: MetaAdsInsightRow): MetricRow[] {
  const base = { date, channel: CHANNEL, source: SOURCE, scope: 'account' as const, scope_id: '' }
  const conversions = sumActions(row, 'lead', 'offsite_conversion.fb_pixel_purchase')
  return [
    { ...base, metric: 'spend', value: num(row.spend) },
    { ...base, metric: 'impressions', value: num(row.impressions) },
    { ...base, metric: 'reach', value: num(row.reach) },
    { ...base, metric: 'clicks', value: num(row.clicks) },
    { ...base, metric: 'cpm', value: num(row.cpm) },
    { ...base, metric: 'cpc', value: num(row.cpc) },
    { ...base, metric: 'ctr', value: num(row.ctr) },
    { ...base, metric: 'conversions', value: conversions },
  ]
}

function campaignRowsForDay(date: string, row: MetaAdsInsightRow): MetricRow[] {
  const campaignId = row.campaign_id ?? ''
  const base = {
    date,
    channel: CHANNEL,
    source: SOURCE,
    scope: 'campaign' as const,
    scope_id: campaignId,
    metadata: {
      campaign_name: row.campaign_name ?? '',
      objective: row.objective ?? '',
    },
  }
  const conversions = sumActions(row, 'lead', 'offsite_conversion.fb_pixel_purchase')
  return [
    { ...base, metric: 'spend', value: num(row.spend) },
    { ...base, metric: 'impressions', value: num(row.impressions) },
    { ...base, metric: 'reach', value: num(row.reach) },
    { ...base, metric: 'clicks', value: num(row.clicks) },
    { ...base, metric: 'cpm', value: num(row.cpm) },
    { ...base, metric: 'cpc', value: num(row.cpc) },
    { ...base, metric: 'ctr', value: num(row.ctr) },
    { ...base, metric: 'conversions', value: conversions },
  ]
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

  const errors: string[] = []
  const metricsCovered = new Set<string>()
  let totalRows = 0

  for (const day of dateIter(startDate, endDate)) {
    try {
      const { accountRow, campaignRows } = await getMetaAdsInsights(day)

      const rows: MetricRow[] = []

      if (accountRow) {
        rows.push(...accountRowsForDay(day, accountRow))
      }

      for (const cr of campaignRows) {
        rows.push(...campaignRowsForDay(day, cr))
      }

      if (rows.length > 0) {
        const upserted = await upsertMetricRows(rows)
        totalRows += upserted
        rows.forEach((r) => metricsCovered.add(r.metric))
      }
    } catch (e) {
      errors.push(`${day}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const result: IngestorResult = {
    channel: CHANNEL,
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
