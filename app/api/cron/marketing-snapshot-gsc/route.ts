/**
 * GSC daily snapshot ingestor.
 *
 * Fetches Google Search Console metrics via getSearchConsoleSummary() and
 * decomposes the response into marketing_channel_daily rows.
 *
 * Default behavior: pulls yesterday only (for the daily Vercel cron).
 * Backfill: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD pulls one row per
 * day in that range, calling GSC once per day to keep per-day attribution
 * accurate.
 *
 * Auth: requires Authorization: Bearer $CRON_SECRET.
 *
 * GSC data freshness note: Search Console data has a 2–3 day processing
 * delay. Running this ingestor for very recent dates (yesterday, 2 days ago)
 * may return zeros or partial data; those rows will be overwritten on
 * subsequent runs once GSC has finished processing. The ingestor is idempotent
 * so backfilling the same date range after the delay clears is safe.
 *
 * Site URL comes from GOOGLE_SEARCH_CONSOLE_SITE_URL env var
 * (e.g. "sc-domain:ryan-realty.com" or "https://ryan-realty.com/").
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSearchConsoleSummary } from '@/app/actions/search-console-report'
import {
  IngestorResult,
  MetricRow,
  isAuthorizedCron,
  parseDateRange,
  upsertMetricRows,
} from '@/lib/marketing-brain/snapshot'

export const maxDuration = 300

const SOURCE = 'gsc_search_analytics_api'

function* dateIter(startDate: string, endDate: string): Generator<string> {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

function rowsForDay(
  date: string,
  summary: Awaited<ReturnType<typeof getSearchConsoleSummary>>
): MetricRow[] {
  if (!summary.ok) return []
  const d = summary.data
  const base = { date, channel: 'gsc' as const, source: SOURCE }

  // Account-scope: channel-wide totals
  const accountRows: MetricRow[] = [
    { ...base, scope: 'account', scope_id: '', metric: 'impressions', value: d.impressions },
    { ...base, scope: 'account', scope_id: '', metric: 'clicks', value: d.clicks },
    { ...base, scope: 'account', scope_id: '', metric: 'avg_ctr', value: d.ctr },
    { ...base, scope: 'account', scope_id: '', metric: 'avg_position', value: d.position },
  ]

  // Query-scope: top 25 queries by impressions
  // scope_id = "query:<the_query>" per taxonomy convention
  const queryRows: MetricRow[] = d.topQueries.flatMap((q) => [
    {
      ...base,
      scope: 'campaign' as const,
      scope_id: `query:${q.key}`,
      metric: 'impressions',
      value: q.impressions,
      metadata: { query: q.key },
    },
    {
      ...base,
      scope: 'campaign' as const,
      scope_id: `query:${q.key}`,
      metric: 'clicks',
      value: q.clicks,
      metadata: { query: q.key },
    },
    {
      ...base,
      scope: 'campaign' as const,
      scope_id: `query:${q.key}`,
      metric: 'ctr',
      value: q.ctr,
      metadata: { query: q.key },
    },
    {
      ...base,
      scope: 'campaign' as const,
      scope_id: `query:${q.key}`,
      metric: 'position',
      value: q.position,
      metadata: { query: q.key },
    },
  ])

  // Page-scope: top 25 pages by impressions
  const pageRows: MetricRow[] = d.topPages.flatMap((p) => [
    {
      ...base,
      scope: 'page' as const,
      scope_id: p.key,
      metric: 'impressions',
      value: p.impressions,
      metadata: { page_url: p.key },
    },
    {
      ...base,
      scope: 'page' as const,
      scope_id: p.key,
      metric: 'clicks',
      value: p.clicks,
      metadata: { page_url: p.key },
    },
    {
      ...base,
      scope: 'page' as const,
      scope_id: p.key,
      metric: 'ctr',
      value: p.ctr,
      metadata: { page_url: p.key },
    },
    {
      ...base,
      scope: 'page' as const,
      scope_id: p.key,
      metric: 'position',
      value: p.position,
      metadata: { page_url: p.key },
    },
  ])

  return [...accountRows, ...queryRows, ...pageRows]
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
      const summary = await getSearchConsoleSummary(day, day)
      if (!summary.ok) {
        errors.push(`${day}: ${summary.error}`)
        continue
      }
      const rows = rowsForDay(day, summary)
      const upserted = await upsertMetricRows(rows)
      totalRows += upserted
      rows.forEach((r) => metricsCovered.add(r.metric))
    } catch (e) {
      errors.push(`${day}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const result: IngestorResult = {
    channel: 'gsc',
    startDate,
    endDate,
    rowsUpserted: totalRows,
    metricsCovered: [...metricsCovered],
    errors,
    fetchedAt: new Date().toISOString(),
  }

  return NextResponse.json(result)
}
