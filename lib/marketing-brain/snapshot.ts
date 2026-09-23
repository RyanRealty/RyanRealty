/**
 * marketing-brain snapshot helpers.
 *
 * Shared utilities for ingestor routes that write daily metrics to
 * `marketing_channel_daily`. All ingestors follow the same pattern:
 *
 *   1. Fetch from the platform API for a date range.
 *   2. Decompose the response into MetricRow tuples.
 *   3. Call upsertMetricRows() to write to Supabase.
 *
 * Each row is keyed on (date, channel, scope, scope_id, metric) so
 * re-running an ingestor for the same date is idempotent.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type Channel =
  | 'meta_ads'
  | 'meta_page'
  | 'instagram'
  | 'ga4'
  | 'gsc'
  | 'fub'
  | 'youtube'
  | 'linkedin'
  | 'x'
  | 'tiktok'
  | 'gbp'
  | 'threads'
  | 'nextdoor'
  | 'pinterest'
  | 'email'
  | 'google_ads'
  /** Monthly answer-engine citation battery (AEO-9, lib/seo/answer-engine-battery.ts). */
  | 'answer_engine'

export type Scope =
  | 'account'
  | 'campaign'
  | 'adset'
  | 'ad'
  | 'post'
  | 'page'
  | 'video'
  | 'sequence'
  | 'channel'
  | 'source'
  | 'lp'
  | 'event'
  | 'page_event'
  | 'audience'

export interface MetricRow {
  date: string // YYYY-MM-DD
  channel: Channel
  scope: Scope
  scope_id: string
  metric: string
  value: number
  metadata?: Record<string, unknown>
  source: string
}

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service-role credentials not configured')
  }
  return createClient(url, key)
}

/**
 * Upsert metric rows into marketing_channel_daily. Conflicts on the
 * composite primary key (date, channel, scope, scope_id, metric) result
 * in the new row replacing the old.
 *
 * Returns the count of rows upserted. Throws on error.
 */
export async function upsertMetricRows(rows: MetricRow[]): Promise<number> {
  if (rows.length === 0) return 0

  // Dedupe by primary key — last write wins. Without this, Postgres
  // rejects the batch with "ON CONFLICT DO UPDATE cannot affect row a
  // second time" when the upstream API returns the same source_medium
  // or pagePath twice within a single day's response.
  const pkMap = new Map<string, MetricRow>()
  for (const r of rows) {
    const pk = `${r.date}|${r.channel}|${r.scope}|${r.scope_id}|${r.metric}`
    pkMap.set(pk, r)
  }
  const deduped = Array.from(pkMap.values())

  const supabase = getSupabase()
  const payload = deduped.map((r) => ({
    date: r.date,
    channel: r.channel,
    scope: r.scope,
    scope_id: r.scope_id,
    metric: r.metric,
    value: r.value,
    metadata: r.metadata ?? {},
    source: r.source,
    fetched_at: new Date().toISOString(),
  }))

  const BATCH = 500
  let total = 0
  for (let i = 0; i < payload.length; i += BATCH) {
    const chunk = payload.slice(i, i + BATCH)
    const { error } = await supabase
      .from('marketing_channel_daily')
      .upsert(chunk, { onConflict: 'date,channel,scope,scope_id,metric' })
    if (error) {
      throw new Error(`upsertMetricRows batch ${i}/${payload.length}: ${error.message}`)
    }
    total += chunk.length
  }
  return total
}

/**
 * A rolling default window, in whole UTC days before `now`. `{ fromDaysAgo: 3,
 * toDaysAgo: 1 }` is today-3..today-1.
 */
export type DefaultWindow = { fromDaysAgo: number; toDaysAgo: number }

/**
 * Parse a date range from a Request URL. Defaults to "yesterday" when no
 * params are provided so the daily cron is one line. Supports a 90-day
 * backfill via ?startDate=2026-02-12&endDate=2026-05-12.
 *
 * `defaultWindow` replaces the yesterday-only default for a platform whose
 * numbers keep arriving after the day ends: re-pulling a settle window every
 * run corrects a late or partial day in place (upsertMetricRows is keyed on
 * the day). The GA4 ingestor uses today-3..today-1 (visibility audit
 * 2026-09-22, TRACK-2); the GSC ingestor rolls its own today-9..today-2.
 */
export function parseDateRange(
  request: Request,
  defaultWindow: DefaultWindow = { fromDaysAgo: 1, toDaysAgo: 1 },
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  const url = new URL(request.url)
  const startDate = url.searchParams.get('startDate')?.trim()
  const endDate = url.searchParams.get('endDate')?.trim()

  if (startDate && endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new Error('startDate and endDate must be YYYY-MM-DD')
    }
    return { startDate, endDate }
  }

  const isoDaysAgo = (n: number) => {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - n)
    return d.toISOString().slice(0, 10)
  }
  return { startDate: isoDaysAgo(defaultWindow.fromDaysAgo), endDate: isoDaysAgo(defaultWindow.toDaysAgo) }
}

/**
 * Read one stored series back (a single channel/scope/scope_id/metric) over an
 * inclusive date range, oldest first. Used by ingestors that judge a day
 * against other stored days (the GA4 tracking-health guard reads GSC clicks).
 */
export async function readMetricSeries(key: {
  channel: Channel
  scope: Scope
  scope_id: string
  metric: string
  from: string
  to: string
}): Promise<Array<{ date: string; value: number }>> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('marketing_channel_daily')
    .select('date,value')
    .eq('channel', key.channel)
    .eq('scope', key.scope)
    .eq('scope_id', key.scope_id)
    .eq('metric', key.metric)
    .gte('date', key.from)
    .lte('date', key.to)
    .order('date', { ascending: true })
    .limit(1000)
  if (error) throw new Error(`readMetricSeries ${key.channel}/${key.metric}: ${error.message}`)
  return (data ?? []).map((r) => ({ date: String(r.date), value: Number(r.value) || 0 }))
}

/**
 * Verify the calling request is authorized to run cron ingestors.
 * Vercel cron sends a bearer token in the Authorization header that
 * matches CRON_SECRET. Manual invocations from the dashboard need to
 * pass the same.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

/**
 * Each ingestor's response shape. Returned as JSON from the route.
 */
export interface IngestorResult {
  channel: Channel
  startDate: string
  endDate: string
  rowsUpserted: number
  metricsCovered: string[]
  errors: string[]
  fetchedAt: string
}
