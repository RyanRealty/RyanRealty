/**
 * The latest answer-engine citation battery, read back for the loop (AEO-9).
 *
 * Writer: app/api/cron/answer-engine-citations (monthly) through
 * lib/seo/answer-engine-battery.ts, into marketing_channel_daily; read here
 * through the site_signal view with source = ANSWER_ENGINE_SOURCE. UNKNOWN
 * when unread, never a zero: a month with no run reports status 'unread'.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { ANSWER_ENGINE_SOURCE } from '@/lib/seo/answer-engine-battery'

export type AnswerEngineCitations = {
  status: 'ok' | 'unread' | 'unreadable'
  /** Date of the newest run, YYYY-MM-DD. */
  runDate: string | null
  queriesRun: number
  queriesAnswered: number
  queriesCited: number
  /** Queries whose answer cited ryan-realty.com, by query text. */
  citedQueries: string[]
  /** Domains cited instead of us, most queries first. */
  topCompetitors: Array<{ domain: string; queries: number }>
  source: string
}

type SignalRow = { date: string | null; surface: string | null; metric: string | null; value: number | string | null; scope: string | null }

/**
 * Pure fold of the newest run's rows. Exported for tests so the reader's
 * arithmetic is checked without a database.
 */
export function foldAnswerEngineRows(rows: readonly SignalRow[]): Omit<AnswerEngineCitations, 'status' | 'source'> {
  const dates = rows.map((r) => r.date).filter((d): d is string => Boolean(d)).sort()
  const runDate = dates.length > 0 ? dates[dates.length - 1]! : null
  const latest = rows.filter((r) => r.date === runDate)
  const account = (metric: string) => {
    const row = latest.find((r) => r.scope === 'account' && r.metric === metric)
    const n = Number(row?.value)
    return Number.isFinite(n) ? n : 0
  }
  const citedQueries = latest
    .filter((r) => r.scope === 'campaign' && r.metric === 'cited' && Number(r.value) === 1)
    .map((r) => String(r.surface ?? '').replace(/^query:/, ''))
    .filter(Boolean)
    .sort()
  const topCompetitors = latest
    .filter((r) => r.scope === 'source' && r.metric === 'competitor_citations' && r.surface)
    .map((r) => ({ domain: String(r.surface), queries: Number(r.value) || 0 }))
    .sort((a, b) => b.queries - a.queries || a.domain.localeCompare(b.domain))
    .slice(0, 8)
  return {
    runDate,
    queriesRun: account('queries_run'),
    queriesAnswered: account('queries_answered'),
    queriesCited: account('queries_cited'),
    citedQueries,
    topCompetitors,
  }
}

/** The newest run's summary. Reads at most the last 62 days of battery rows. */
export async function readAnswerEngineCitations(
  sb: SupabaseClient,
  now: Date = new Date(),
): Promise<AnswerEngineCitations> {
  const since = new Date(now.getTime() - 62 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const source = `site_signal source=${ANSWER_ENGINE_SOURCE} date >= ${since} (newest run)`
  const { data, error } = await sb
    .from('site_signal')
    .select('date,surface,metric,value,scope')
    .eq('source', ANSWER_ENGINE_SOURCE)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(2000)
  if (error) {
    return {
      status: 'unreadable',
      runDate: null,
      queriesRun: 0,
      queriesAnswered: 0,
      queriesCited: 0,
      citedQueries: [],
      topCompetitors: [],
      source,
    }
  }
  const folded = foldAnswerEngineRows((data ?? []) as SignalRow[])
  return { status: folded.runDate ? 'ok' : 'unread', ...folded, source }
}

/** True when a battery run already landed in the calendar month of `now` (UTC). */
export function ranThisMonth(runDate: string | null, now: Date = new Date()): boolean {
  return Boolean(runDate && runDate.slice(0, 7) === now.toISOString().slice(0, 7))
}
