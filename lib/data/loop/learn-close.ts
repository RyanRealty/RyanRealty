/**
 * THE LOOP Learn step, as a library (moved from scripts/loop-learn-close-windows.ts
 * so the weekly cron and the CLI close windows with one rule set).
 *
 * For every due site_improvement_ledger row, measure the named metric over the
 * row's window, write actual_delta + verdict + a §0 trace into notes.
 *
 * Fixed here (visibility audit 2026-09-22, gsc-trend-2):
 *  - Surfaces are normalized on BOTH sides. The ledger holds '/blog/x', the GSC
 *    snapshot stores 'https://ryan-realty.com/blog/x'; the old join matched
 *    nothing and 8 of 12 learned rows were written as a measured 0.
 *  - The site_signal read is filtered to the GSC source, and it only counts
 *    when the page is present on every day of the window (that series keeps the
 *    top 25 pages a day, so a partial window undercounts).
 *  - GSC metrics prefer the full store (gsc_page_daily), then a live GSC pull.
 *  - No data is not zero. An unmeasurable window keeps actual_delta NULL and
 *    gets verdict 'unmeasurable' with the gap named. A verdict closes the row
 *    (the guard trigger reads verdict since migration 20260923150000); until
 *    that migration is applied the check constraint refuses 'unmeasurable' and
 *    the row is written 'inconclusive', still with a NULL delta.
 *  - A window is due only once its last day is settled in GSC (3 days).
 *
 * Verdict rules (printed with every row so anyone can re-verdict):
 *   no usable rows in window             -> unmeasurable (gap named), actual_delta NULL
 *   |delta| >= 0.5|predicted|, same sign -> win
 *   |delta| >= 0.5|predicted|, opposite  -> loss
 *   otherwise                            -> flat
 * reachability: entry-point scripts/loop-learn-close-windows.ts + app/api/cron/loop-weekly-measure
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { LedgerVerdict } from './domains'
import { addDays, daysBetweenInclusive, isoDate, pullAllGscRows, settledEndDate, type GscQueryFn } from './gsc-api'
import { normalizeGscPath } from './gsc-page-class'
import { readGscStorePageTotals } from './gsc-store'
import { isExpiredUnlearned } from './ledger-draft'

export const GSC_SNAPSHOT_SOURCE = 'gsc_search_analytics_api'

export type LearnLedgerRow = {
  id: string
  domain: string
  change_class: string
  surface: string
  metric: string
  baseline_value: number | null
  predicted_delta: number | null
  window_days: number
  shipped_at: string
  actual_delta: number | null
  verdict: string | null
  notes: string | null
}

export type Measured =
  | { ok: true; after: number; rows: number; source: string }
  | { ok: false; gap: string; source: string }

export type PageTotals = Map<string, { clicks: number; impressions: number }>

export type LearnDeps = {
  sb: SupabaseClient
  /** Live GSC page totals for a window keyed by normalized path; null when no GSC credentials. */
  gscPageTotals?: ((from: string, to: string) => Promise<PageTotals>) | null
}

/**
 * The measured window: window_days days starting on the ship day (UTC),
 * inclusive. A "28d" metric reads exactly 28 days; the pre-fix script read 29
 * (it ended on shipped + window_days), which padded every sum by a day.
 */
export function learnWindow(row: { shipped_at: string; window_days: number }): { from: string; to: string } {
  const from = isoDate(new Date(row.shipped_at))
  return { from, to: addDays(from, Math.max(1, Number(row.window_days ?? 14)) - 1) }
}

/** A window is due when its last day is settled in GSC. */
export function isWindowSettled(row: { shipped_at: string; window_days: number }, now: Date = new Date()): boolean {
  return learnWindow(row).to <= settledEndDate(now)
}

/**
 * The ledger surface as a list of normalized paths, or null when it is not an
 * enumerable set of URLs on this site ("legacy market-report archive (51 urls)").
 */
export function surfacePaths(surface: string): string[] | null {
  const parts = surface.includes(' + ') ? surface.split(' + ') : [surface]
  const out: string[] = []
  for (const raw of parts) {
    const p = raw.trim()
    if (!p.startsWith('/') && !/^https?:\/\//i.test(p)) return null
    if (/\s/.test(p)) return null
    const n = normalizeGscPath(p)
    if (!n) return null
    out.push(n)
  }
  return out.length ? out : null
}

/** Every spelling the GSC snapshot has stored a page under (it keeps the full URL). */
export function surfaceUrlVariants(path: string): string[] {
  const p = normalizeGscPath(path)
  const bare = p === '/' ? '' : p
  const out = new Set<string>([p])
  for (const host of ['https://ryan-realty.com', 'https://www.ryan-realty.com']) {
    out.add(`${host}${bare}`)
    out.add(`${host}${bare}/`)
  }
  return [...out]
}

export function verdictFor(delta: number, predicted: number | null): 'win' | 'loss' | 'flat' {
  if (predicted == null || predicted === 0) return Math.abs(delta) > 0 ? 'win' : 'flat'
  const meaningful = Math.abs(delta) >= 0.5 * Math.abs(predicted)
  if (!meaningful) return 'flat'
  return Math.sign(delta) === Math.sign(predicted) ? 'win' : 'loss'
}

type Sums = { clicks: number; impressions: number; rows: number; source: string }

/** site_signal page rows for the GSC source, counted only when the page is present every day. */
async function siteSignalSums(
  sb: SupabaseClient,
  paths: string[],
  from: string,
  to: string,
): Promise<{ ok: true; sums: Sums } | { ok: false; gap: string; source: string }> {
  const variants = paths.flatMap(surfaceUrlVariants)
  const source = `site_signal scope=page source=${GSC_SNAPSHOT_SOURCE} surface in normalized(${paths.join(', ')}) date ${from}..${to}`
  const { data, error } = await sb
    .from('site_signal')
    .select('surface,metric,value,date')
    .eq('scope', 'page')
    .eq('source', GSC_SNAPSHOT_SOURCE)
    .in('metric', ['clicks', 'impressions'])
    .in('surface', variants)
    .gte('date', from)
    .lte('date', to)
  if (error) return { ok: false, gap: `query error: ${error.message}`, source }
  const rows = (data ?? []) as Array<{ surface: string; metric: string; value: number; date: string }>
  const days = daysBetweenInclusive(from, to)
  for (const p of paths) {
    const present = new Set(
      rows.filter((r) => r.metric === 'impressions' && normalizeGscPath(r.surface) === p).map((r) => r.date),
    )
    if (present.size < days) {
      return {
        ok: false,
        gap: `${p} is in the top-25/day sample on ${present.size} of ${days} days, so a sum would undercount`,
        source,
      }
    }
  }
  let clicks = 0
  let impressions = 0
  for (const r of rows) {
    if (r.metric === 'clicks') clicks += Number(r.value)
    if (r.metric === 'impressions') impressions += Number(r.value)
  }
  return { ok: true, sums: { clicks, impressions, rows: rows.length, source } }
}

/** Clicks + impressions for the surface paths: store, then live GSC, then a complete site_signal sample. */
async function gscSums(deps: LearnDeps, paths: string[], from: string, to: string): Promise<{ ok: true; sums: Sums } | { ok: false; gap: string; source: string }> {
  const gaps: string[] = []
  const store = await readGscStorePageTotals(deps.sb, paths, from, to)
  if (store.covered) {
    return {
      ok: true,
      sums: {
        clicks: store.clicks,
        impressions: store.impressions,
        rows: store.rows,
        source: `gsc_page_daily page in (${paths.join(', ')}) date ${from}..${to}`,
      },
    }
  }
  gaps.push(`store: ${store.reason}`)
  if (deps.gscPageTotals) {
    try {
      const totals = await deps.gscPageTotals(from, to)
      let clicks = 0
      let impressions = 0
      let found = 0
      for (const p of paths) {
        const t = totals.get(p)
        if (t) {
          clicks += t.clicks
          impressions += t.impressions
          found += 1
        }
      }
      // A page GSC did not return had no impressions in the window: the page
      // dimension is not anonymized, so absence here is a real zero.
      return {
        ok: true,
        sums: {
          clicks,
          impressions,
          rows: found,
          source: `GSC Search Analytics live pull, dimension page, ${from}..${to}, rowLimit 25,000 paged (${totals.size} pages in the property), normalized path in (${paths.join(', ')}), ${found} of ${paths.length} present`,
        },
      }
    } catch (err) {
      gaps.push(`live GSC: ${(err as Error).message}`)
    }
  } else {
    gaps.push('live GSC: no service-account credentials')
  }
  const signal = await siteSignalSums(deps.sb, paths, from, to)
  if (signal.ok) return signal
  gaps.push(`site_signal: ${signal.gap}`)
  return { ok: false, gap: gaps.join('; '), source: signal.source }
}

export async function measureLedgerRow(deps: LearnDeps, row: LearnLedgerRow): Promise<Measured> {
  const { from, to } = learnWindow(row)
  const win = `${from}..${to}`

  if (row.metric === 'gsc_clicks_28d' || row.metric === 'gsc_impressions_28d' || row.metric === 'gsc_ctr_pct_28d') {
    const paths = surfacePaths(row.surface)
    if (!paths) {
      return {
        ok: false,
        gap: `surface "${row.surface}" is not an enumerated set of URLs, so no page series can be read for it`,
        source: `GSC page series ${win}`,
      }
    }
    const res = await gscSums(deps, paths, from, to)
    if (!res.ok) return res
    if (row.metric === 'gsc_ctr_pct_28d') {
      if (res.sums.impressions === 0) {
        return { ok: false, gap: 'no impressions in the window, so CTR is undefined', source: res.sums.source }
      }
      return {
        ok: true,
        after: (res.sums.clicks / res.sums.impressions) * 100,
        rows: res.sums.rows,
        source: `${res.sums.source}; CTR = ${res.sums.clicks} clicks / ${res.sums.impressions} impressions`,
      }
    }
    const after = row.metric === 'gsc_clicks_28d' ? res.sums.clicks : res.sums.impressions
    return { ok: true, after, rows: res.sums.rows, source: res.sums.source }
  }

  if (row.metric === 'lcp_p75_ms') {
    const path = normalizeGscPath(row.surface)
    const src = `web_vitals metric=LCP path=${path} created_at ${win}`
    const { data, error } = await deps.sb
      .from('web_vitals')
      .select('value')
      .eq('metric', 'LCP')
      .eq('path', path)
      .gte('created_at', from)
      .lte('created_at', `${to}T23:59:59Z`)
    if (error) return { ok: false, gap: `query error: ${error.message}`, source: src }
    const values = (data ?? []).map((r) => Number((r as { value: number }).value)).sort((a, b) => a - b)
    if (values.length === 0) return { ok: false, gap: 'no LCP samples for this path in the window', source: src }
    const p75 = values[Math.min(values.length - 1, Math.floor(values.length * 0.75))] as number
    return { ok: true, after: p75, rows: values.length, source: src }
  }

  if (row.metric === 'ga4_engagement_rate_28d' || row.metric === 'ai_assistant_sessions_28d') {
    const metric = row.metric === 'ga4_engagement_rate_28d' ? 'engagement_rate' : 'ai_assistant_sessions'
    const src = `site_signal scope=account metric=${metric} date ${win}`
    const { data, error } = await deps.sb
      .from('site_signal')
      .select('value,date')
      .eq('scope', 'account')
      .eq('metric', metric)
      .gte('date', from)
      .lte('date', to)
    if (error) return { ok: false, gap: `query error: ${error.message}`, source: src }
    const values = (data ?? []).map((r) => Number((r as { value: number }).value))
    if (values.length === 0) return { ok: false, gap: 'no account-scope rows in the window', source: src }
    const after =
      metric === 'engagement_rate'
        ? values.reduce((a, b) => a + b, 0) / values.length
        : values.reduce((a, b) => a + b, 0)
    return { ok: true, after, rows: values.length, source: src }
  }

  return {
    ok: false,
    gap: `no measurement mapping for metric "${row.metric}" and no stored history to read it back at the window end`,
    source: 'unmapped',
  }
}

export type LearnOutcome = {
  id: string
  changeClass: string
  metric: string
  window: string
  verdict: LedgerVerdict
  actualDelta: number | null
  trace: string
  written: boolean
  error: string | null
}

type PgError = { code?: string | null; message?: string | null } | null

/**
 * Close one ledger row. A NULL actual_delta is allowed only with verdict
 * inconclusive or unmeasurable (no data is not zero). Notes are replaced with
 * what the caller passes, so pass the old notes plus the new line.
 */
export async function closeLedgerRowWith(
  sb: SupabaseClient,
  input: { id: string; actualDelta: number | null; verdict: LedgerVerdict; notes?: string | null; measuredAt?: string },
): Promise<{ data: { id: string } | null; error: string | null; code?: string | null }> {
  if (!input.id.trim()) return { data: null, error: 'id is required' }
  const noData = input.verdict === 'inconclusive' || input.verdict === 'unmeasurable'
  if (input.actualDelta == null && !noData) {
    return { data: null, error: `verdict "${input.verdict}" needs a measured actualDelta` }
  }
  if (input.actualDelta != null && !Number.isFinite(input.actualDelta)) {
    return { data: null, error: 'actualDelta must be a finite number or null' }
  }
  if (input.verdict === 'unmeasurable' && input.actualDelta != null) {
    return { data: null, error: 'an unmeasurable window has no actualDelta' }
  }
  const patch: Record<string, unknown> = {
    actual_delta: input.actualDelta,
    verdict: input.verdict,
    measured_at: input.measuredAt ?? new Date().toISOString(),
  }
  if (input.notes != null) patch.notes = input.notes
  const { data, error } = await sb.from('site_improvement_ledger').update(patch).eq('id', input.id).select('id').single()
  if (error || !data?.id) {
    return { data: null, error: error?.message ?? 'update matched no row', code: (error as PgError)?.code ?? null }
  }
  return { data: { id: String(data.id) }, error: null }
}

/** Live GSC page totals for a window, keyed by normalized path (one paged pull per distinct window). */
export function liveGscPageTotals(query: GscQueryFn): (from: string, to: string) => Promise<PageTotals> {
  const cache = new Map<string, Promise<PageTotals>>()
  return (from, to) => {
    const key = `${from}..${to}`
    const hit = cache.get(key)
    if (hit) return hit
    const p = pullAllGscRows(query, { startDate: from, endDate: to, dimensions: ['page'] }).then(({ rows }) => {
      const m: PageTotals = new Map()
      for (const r of rows) {
        const path = normalizeGscPath(r.keys[0])
        if (!path) continue
        const t = m.get(path) ?? { clicks: 0, impressions: 0 }
        t.clicks += r.clicks
        t.impressions += r.impressions
        m.set(path, t)
      }
      return m
    })
    cache.set(key, p)
    return p
  }
}

const LEDGER_COLS =
  'id,domain,change_class,surface,metric,baseline_value,predicted_delta,window_days,shipped_at,actual_delta,verdict,notes'

/**
 * Learn every due window: open (no actual_delta and no verdict), past its
 * window, last day settled. With `ids`, those rows only, open or not (a
 * re-learn of rows an earlier pass closed wrongly); the new trace is appended
 * to the old notes, never replacing them.
 */
export async function learnDueWindows(
  deps: LearnDeps,
  opts: { now?: Date; domain?: string | null; ids?: string[]; dryRun?: boolean; label?: string } = {},
): Promise<{ due: number; outcomes: LearnOutcome[]; error: string | null }> {
  const now = opts.now ?? new Date()
  let q = deps.sb.from('site_improvement_ledger').select(LEDGER_COLS)
  if (opts.ids?.length) q = q.in('id', opts.ids)
  else q = q.is('actual_delta', null).is('verdict', null)
  if (opts.domain) q = q.eq('domain', opts.domain)
  const { data, error } = await q
  if (error) return { due: 0, outcomes: [], error: String(error.message) }

  const rows = ((data ?? []) as LearnLedgerRow[]).filter((r) => {
    if (!isWindowSettled(r, now)) return false
    if (opts.ids?.length) return true
    return isExpiredUnlearned({ shippedAt: r.shipped_at, windowDays: r.window_days, actualDelta: r.actual_delta, verdict: r.verdict }, now)
  })

  const day = isoDate(now)
  const label = opts.label ? ` (${opts.label})` : ''
  const outcomes: LearnOutcome[] = []
  for (const row of rows) {
    const { from, to } = learnWindow(row)
    const m = await measureLedgerRow(deps, row)
    let verdict: LedgerVerdict
    let actualDelta: number | null
    let trace: string
    if (m.ok) {
      const baseline = Number(row.baseline_value ?? 0)
      actualDelta = Number((m.after - baseline).toFixed(4))
      verdict = verdictFor(actualDelta, row.predicted_delta == null ? null : Number(row.predicted_delta))
      trace = `Learn ${day}${label} (${from}..${to}): after=${Number(m.after.toFixed(4))} over ${m.rows} rows — ${m.source}. baseline ${row.baseline_value ?? 0}, delta=${actualDelta} vs predicted ${row.predicted_delta}. Verdict rule: |delta|>=0.5|predicted| same-sign=win, opposite=loss, else flat.`
    } else {
      actualDelta = null
      verdict = 'unmeasurable'
      trace = `Learn ${day}${label}: UNMEASURABLE (${from}..${to}) — ${m.gap}. Source checked: ${m.source}. actual_delta stays NULL: no data is not a measured zero.`
    }
    const outcome: LearnOutcome = {
      id: row.id,
      changeClass: row.change_class,
      metric: row.metric,
      window: `${from}..${to}`,
      verdict,
      actualDelta,
      trace,
      written: false,
      error: null,
    }
    if (!opts.dryRun) {
      const notes = row.notes ? `${row.notes}\n${trace}` : trace
      let res = await closeLedgerRowWith(deps.sb, { id: row.id, actualDelta, verdict, notes })
      if (res.error && verdict === 'unmeasurable' && (res.code === '23514' || /check constraint/i.test(res.error))) {
        // Migration 20260923150000 widens the verdict check. Until it lands the
        // honest fallback is 'inconclusive' with the delta still NULL.
        outcome.verdict = 'inconclusive'
        outcome.trace = `${trace} Stored as 'inconclusive' (verdict 'unmeasurable' needs migration 20260923150000).`
        res = await closeLedgerRowWith(deps.sb, {
          id: row.id,
          actualDelta: null,
          verdict: 'inconclusive',
          notes: row.notes ? `${row.notes}\n${outcome.trace}` : outcome.trace,
        })
      }
      outcome.written = !res.error
      outcome.error = res.error
    }
    outcomes.push(outcome)
  }
  return { due: rows.length, outcomes, error: null }
}
