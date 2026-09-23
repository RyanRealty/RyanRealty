/**
 * Crawl-probe rows: the daily crawl-surface monitor's writes and the reads the
 * loop makes of them. Rows live in marketing_channel_daily, which the
 * site_signal view unions, so every check surfaces in site_signal with
 * channel = source = 'crawl_probe' and surface = the checked path
 * ('site:crawl_probe' for the run summary). scope 'crawl_probe' keeps them out
 * of per-page aggregations, which filter scope = 'page' (site_signal contract).
 *
 * value is 1 when the check passed and 0 when it failed; the measurements and
 * the failure sentences ride in metadata. A check that fails every day for two
 * weeks therefore reads as a silent zero in the loop brief, which is the
 * correct alarm for a break nobody fixed.
 *
 * No unstable_cache: the cron writes, the loop brief and scoreboard read once
 * per boot, and a monitor that reports a cached "pass" defeats its purpose.
 * reachability: app/api/cron/crawl-probe, collectCompanyScoreboardSignals
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const CRAWL_PROBE_CHANNEL = 'crawl_probe'
export const CRAWL_PROBE_SCOPE = 'crawl_probe'
export const CRAWL_PROBE_SOURCE = 'crawl_probe'
/** Past this age the daily cron has stopped landing, which is its own break. */
export const CRAWL_PROBE_STALE_HOURS = 36

export type CrawlProbeRow = {
  date: string
  /** The checked path; '' for the run summary. Stored as scope_id. */
  surface: string
  metric: string
  value: 0 | 1
  metadata: Record<string, unknown>
}

// Literal table names in .from() below so docs/DAL_INDEX.md and the DAL gates see them.
const TABLE = 'marketing_channel_daily'
const CONFLICT = 'date,channel,scope,scope_id,metric'

/**
 * Upsert one row per check. Idempotent on (date, surface, metric): the sampler
 * is deterministic per day, so a re-run overwrites its own rows.
 */
export async function upsertCrawlProbeRows(
  sb: SupabaseClient,
  rows: readonly CrawlProbeRow[],
  fetchedAt: Date = new Date(),
): Promise<{ written: number; error: string | null }> {
  const byKey = new Map<string, CrawlProbeRow>()
  for (const r of rows) byKey.set(`${r.date}|${r.surface}|${r.metric}`, r)
  const payload = [...byKey.values()].map((r) => ({
    date: r.date,
    channel: CRAWL_PROBE_CHANNEL,
    scope: CRAWL_PROBE_SCOPE,
    scope_id: r.surface,
    metric: r.metric,
    value: r.value,
    metadata: r.metadata,
    source: CRAWL_PROBE_SOURCE,
    fetched_at: fetchedAt.toISOString(),
  }))
  let written = 0
  for (let i = 0; i < payload.length; i += 500) {
    const chunk = payload.slice(i, i + 500)
    const { error } = await sb.from('marketing_channel_daily').upsert(chunk, { onConflict: CONFLICT })
    if (error) return { written, error: `${TABLE} upsert rows ${i}-${i + chunk.length}: ${error.message}` }
    written += chunk.length
  }
  return { written, error: null }
}

function isoDateDaysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

export type CrawlProbeBaseline = {
  /** Child sitemap path -> its URL count on the most recent earlier day it answered 200. */
  counts: Map<string, { count: number; date: string }>
  error: string | null
}

/**
 * Yesterday's answer for each child sitemap, the expectation today's count is
 * held to. Looks back `lookbackDays` so one missed run does not blank the
 * baseline, and skips days the child failed to answer (no count to compare).
 */
export async function readCrawlProbeBaseline(
  sb: SupabaseClient,
  beforeDate: string,
  lookbackDays = 7,
): Promise<CrawlProbeBaseline> {
  const counts = new Map<string, { count: number; date: string }>()
  const { data, error } = await sb
    .from('marketing_channel_daily')
    .select('date,scope_id,metadata')
    .eq('channel', CRAWL_PROBE_CHANNEL)
    .eq('scope', CRAWL_PROBE_SCOPE)
    .eq('metric', 'sitemap_child')
    .lt('date', beforeDate)
    .gte('date', isoDateDaysBefore(beforeDate, lookbackDays))
    .order('date', { ascending: false })
    .limit(200)
  if (error) return { counts, error: error.message }
  for (const row of (data ?? []) as Array<{ date: string; scope_id: string; metadata: Record<string, unknown> | null }>) {
    if (counts.has(row.scope_id)) continue
    const count = Number(row.metadata?.urlCount)
    if (row.metadata?.httpStatus !== 200 || !Number.isFinite(count) || count <= 0) continue
    counts.set(row.scope_id, { count, date: row.date })
  }
  return { counts, error: null }
}

export type CrawlProbeStatus = {
  status: 'ok' | 'unreadable'
  /** UTC date of the latest run, null when the probe has never run. */
  lastRunDate: string | null
  lastRunAt: string | null
  ageHours: number | null
  stale: boolean
  passed: boolean | null
  checks: number
  failed: number
  /** First few "metric surface: reason" lines of the latest run. */
  failures: string[]
  source: string
}

const STATUS_SOURCE = "marketing_channel_daily channel='crawl_probe' metric='run' (site_signal source='crawl_probe'), latest date"

/** The latest crawl-probe run summary, for the scoreboard and the loop brief. */
export async function readCrawlProbeStatus(sb: SupabaseClient, now: Date = new Date()): Promise<CrawlProbeStatus> {
  const empty: CrawlProbeStatus = {
    status: 'ok',
    lastRunDate: null,
    lastRunAt: null,
    ageHours: null,
    stale: true,
    passed: null,
    checks: 0,
    failed: 0,
    failures: [],
    source: STATUS_SOURCE,
  }
  let data: unknown[] | null = null
  let error: { message: string } | null = null
  try {
    ;({ data, error } = await sb
      .from('marketing_channel_daily')
      .select('date,value,metadata,fetched_at')
      .eq('channel', CRAWL_PROBE_CHANNEL)
      .eq('scope', CRAWL_PROBE_SCOPE)
      .eq('metric', 'run')
      .order('date', { ascending: false })
      .limit(1))
  } catch (err) {
    error = { message: err instanceof Error ? err.message : String(err) }
  }
  if (error) return { ...empty, status: 'unreadable', source: `${STATUS_SOURCE} (read failed: ${error.message})` }
  const row = (data ?? [])[0] as
    | { date: string; value: number | string; metadata: Record<string, unknown> | null; fetched_at: string }
    | undefined
  if (!row) return empty
  const meta = row.metadata ?? {}
  const lastRunAt = row.fetched_at ?? null
  const ageHours = lastRunAt ? Math.round(((now.getTime() - Date.parse(lastRunAt)) / 3_600_000) * 10) / 10 : null
  return {
    status: 'ok',
    lastRunDate: row.date,
    lastRunAt,
    ageHours,
    stale: ageHours == null || ageHours > CRAWL_PROBE_STALE_HOURS,
    passed: Number(row.value) === 1,
    checks: Number(meta.checks ?? 0) || 0,
    failed: Number(meta.failed ?? 0) || 0,
    failures: Array.isArray(meta.failures) ? (meta.failures as unknown[]).slice(0, 5).map(String) : [],
    source: STATUS_SOURCE,
  }
}

/** One line for the loop brief. */
export function formatCrawlProbeLine(s: CrawlProbeStatus): string {
  if (s.status === 'unreadable') return `UNREADABLE (${s.source})`
  if (!s.lastRunDate) return 'never ran (/api/cron/crawl-probe, daily 11:55 UTC)'
  const age = s.ageHours == null ? '' : `, ${s.ageHours}h ago`
  const stale = s.stale ? `STALE, last run over ${CRAWL_PROBE_STALE_HOURS}h ago. ` : ''
  if (s.passed) return `${stale}PASS ${s.checks} checks on ${s.lastRunDate}${age}`
  const top = s.failures.slice(0, 3).join('; ')
  return `${stale}FAIL ${s.failed} of ${s.checks} checks on ${s.lastRunDate}${age}${top ? `: ${top}` : ''}`
}
