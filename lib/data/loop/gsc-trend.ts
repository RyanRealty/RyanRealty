/**
 * Search visibility by page class, trended (visibility audit 2026-09-22,
 * gsc-trend-1, TRACK-11). This replaces the scoreboard's old GSC signal, which
 * was "ok" whenever a count of target_query_benchmark rows did not error while
 * every one of those rows was a rank tracker's quoted query.
 *
 * Windows are anchored on the newest stored settled day, not on today: the
 * store is filled weekly, and a window that ran past the stored data would
 * read as a drop.
 *
 *   cur28  = the 28 stored days ending at the anchor
 *   prev28 = the 28 days before that        (the "degraded" rule reads these)
 *   cur7   = the 7 days ending at the anchor
 *   prev7  = the 7 days before that         (week over week, printed by the brief)
 *
 * Degraded = a money class (./gsc-page-class GSC_MONEY_CLASSES), not routed out
 * of market, lost >= 15% of its impressions or >= 3 positions of
 * impression-weighted average position, 28d vs the prior 28d. A class needs a
 * floor of prior impressions before a percentage means anything; the floor is
 * a named constant below, not a statistic.
 * reachability: entry-point lib/data/loop/signals.ts + scripts/loop-brief.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import { addDays, daysBetweenInclusive, settledEndDate } from './gsc-api'
import { isCentralOregonMoneyClass } from './gsc-page-class'
import { readGscClassRollup, readGscStoreCoverage, type GscClassRollupRow } from './gsc-store'

export const DEGRADED_IMPRESSIONS_DROP_PCT = 15
export const DEGRADED_POSITION_WORSE = 3
/** Below this many prior-window impressions a class is too small to call a slip. */
export const DEGRADED_MIN_PRIOR_IMPRESSIONS = 100
/** A store whose newest day is this far behind the settled day has stopped being filled. */
export const STORE_STALE_DAYS = 10

export type GscWindow = { start: string; end: string }
export type GscTrendWindows = { cur28: GscWindow; prev28: GscWindow; cur7: GscWindow; prev7: GscWindow }

export function trendWindows(anchor: string): GscTrendWindows {
  return {
    cur28: { start: addDays(anchor, -27), end: anchor },
    prev28: { start: addDays(anchor, -55), end: addDays(anchor, -28) },
    cur7: { start: addDays(anchor, -6), end: anchor },
    prev7: { start: addDays(anchor, -13), end: addDays(anchor, -7) },
  }
}

export type GscTotals = { clicks: number; impressions: number; position: number | null; pages: number }

export type GscClassDelta = {
  pageClass: string
  market: string
  money: boolean
  cur: GscTotals
  prev: GscTotals
  clicksDelta: number
  impressionsDelta: number
  /** Percent change in impressions; null when the prior window had none. */
  impressionsPct: number | null
  /** Positive = worse (the average position number rose). Null when either side had no impressions. */
  positionDelta: number | null
}

const ZERO: GscTotals = { clicks: 0, impressions: 0, position: null, pages: 0 }

function totals(r: GscClassRollupRow | undefined): GscTotals {
  if (!r) return ZERO
  return { clicks: r.clicks, impressions: r.impressions, position: r.position, pages: r.pages }
}

/** Join two rollups on (class, market). A class present on one side only compares against zero. */
export function diffRollups(cur: GscClassRollupRow[], prev: GscClassRollupRow[]): GscClassDelta[] {
  const key = (r: { pageClass: string; market: string }) => `${r.pageClass}\u0000${r.market}`
  const curBy = new Map(cur.map((r) => [key(r), r]))
  const prevBy = new Map(prev.map((r) => [key(r), r]))
  const keys = new Set([...curBy.keys(), ...prevBy.keys()])
  const out: GscClassDelta[] = []
  for (const k of keys) {
    const [pageClass, market] = k.split('\u0000') as [string, string]
    const c = totals(curBy.get(k))
    const p = totals(prevBy.get(k))
    out.push({
      pageClass,
      market,
      money: isCentralOregonMoneyClass(pageClass, market),
      cur: c,
      prev: p,
      clicksDelta: c.clicks - p.clicks,
      impressionsDelta: c.impressions - p.impressions,
      impressionsPct: p.impressions > 0 ? Number((((c.impressions - p.impressions) / p.impressions) * 100).toFixed(1)) : null,
      positionDelta:
        c.position != null && p.position != null && c.impressions > 0 && p.impressions > 0
          ? Number((c.position - p.position).toFixed(1))
          : null,
    })
  }
  return out.sort((a, b) => Math.abs(b.impressionsDelta) - Math.abs(a.impressionsDelta))
}

export function isDegradedClass(d: GscClassDelta): boolean {
  if (!d.money) return false
  if (d.prev.impressions < DEGRADED_MIN_PRIOR_IMPRESSIONS) return false
  const lostImpressions = d.impressionsPct != null && d.impressionsPct <= -DEGRADED_IMPRESSIONS_DROP_PCT
  const lostPosition = d.positionDelta != null && d.positionDelta >= DEGRADED_POSITION_WORSE
  return lostImpressions || lostPosition
}

/** Why a class is degraded, in one line (goes into the node objective and the brief). */
export function degradedReason(d: GscClassDelta): string {
  const parts: string[] = []
  if (d.impressionsPct != null && d.impressionsPct <= -DEGRADED_IMPRESSIONS_DROP_PCT) {
    parts.push(`impressions ${d.prev.impressions.toLocaleString('en-US')} -> ${d.cur.impressions.toLocaleString('en-US')} (${d.impressionsPct}%)`)
  }
  if (d.positionDelta != null && d.positionDelta >= DEGRADED_POSITION_WORSE) {
    parts.push(`avg position ${d.prev.position} -> ${d.cur.position} (+${d.positionDelta})`)
  }
  return parts.join('; ')
}

export function topMovers(deltas: GscClassDelta[], n = 3): GscClassDelta[] {
  return [...deltas]
    .filter((d) => d.impressionsDelta !== 0 || d.clicksDelta !== 0)
    .sort((a, b) => Math.abs(b.impressionsDelta) - Math.abs(a.impressionsDelta) || Math.abs(b.clicksDelta) - Math.abs(a.clicksDelta))
    .slice(0, n)
}

export function formatClassDelta(d: GscClassDelta): string {
  const sign = (n: number) => (n > 0 ? `+${n.toLocaleString('en-US')}` : n.toLocaleString('en-US'))
  const pct = d.impressionsPct == null ? 'new' : `${d.impressionsPct > 0 ? '+' : ''}${d.impressionsPct}%`
  const pos =
    d.positionDelta == null ? '' : ` · pos ${d.prev.position} -> ${d.cur.position} (${d.positionDelta > 0 ? '+' : ''}${d.positionDelta})`
  return `${d.pageClass} (${d.market}): impr ${d.prev.impressions.toLocaleString('en-US')} -> ${d.cur.impressions.toLocaleString('en-US')} (${sign(d.impressionsDelta)}, ${pct}) · clicks ${d.prev.clicks} -> ${d.cur.clicks} (${sign(d.clicksDelta)})${pos}`
}

export type GscTrend = {
  status: 'ok' | 'degraded' | 'unreadable'
  /** Why unreadable, or the store span that was read. */
  note: string
  anchor: string | null
  windows: GscTrendWindows | null
  classes28: GscClassDelta[]
  degraded: GscClassDelta[]
  wow: GscClassDelta[]
  source: string
}

export const GSC_TREND_SOURCE =
  'gsc_page_daily via gsc_page_class_rollup (GSC Search Analytics, page x date, rowLimit 25,000 paged; impression-weighted position)'

function unreadable(note: string): GscTrend {
  return { status: 'unreadable', note, anchor: null, windows: null, classes28: [], degraded: [], wow: [], source: GSC_TREND_SOURCE }
}

/** Build the trend from four rollups (pure; the reader below does the I/O). */
export function buildGscTrend(input: {
  anchor: string
  windows: GscTrendWindows
  cur28: GscClassRollupRow[]
  prev28: GscClassRollupRow[]
  cur7: GscClassRollupRow[]
  prev7: GscClassRollupRow[]
  note: string
}): GscTrend {
  const classes28 = diffRollups(input.cur28, input.prev28)
  const degraded = classes28.filter(isDegradedClass)
  const wow = topMovers(diffRollups(input.cur7, input.prev7), 3)
  return {
    status: degraded.length ? 'degraded' : 'ok',
    note: input.note,
    anchor: input.anchor,
    windows: input.windows,
    classes28,
    degraded,
    wow,
    source: GSC_TREND_SOURCE,
  }
}

export async function readGscTrend(sb: SupabaseClient, now: Date = new Date()): Promise<GscTrend> {
  const coverage = await readGscStoreCoverage(sb)
  if (coverage.status === 'missing' || coverage.status === 'error') return unreadable(coverage.reason)
  if (coverage.status === 'empty') return unreadable('gsc_page_daily is empty: the weekly measurer has not filled it yet')
  const settled = settledEndDate(now)
  const anchor = coverage.maxDate < settled ? coverage.maxDate : settled
  const lag = daysBetweenInclusive(anchor, settled) - 1
  if (lag > STORE_STALE_DAYS) {
    return unreadable(`gsc_page_daily newest day ${coverage.maxDate} is ${lag} days behind the settled day ${settled}: the weekly measurer stopped`)
  }
  const windows = trendWindows(anchor)
  if (coverage.minDate > windows.prev28.start) {
    return unreadable(`gsc_page_daily starts ${coverage.minDate}; the 28d-vs-prior trend needs ${windows.prev28.start}..${anchor} (run the backfill)`)
  }
  const [cur28, prev28, cur7, prev7] = await Promise.all([
    readGscClassRollup(sb, windows.cur28.start, windows.cur28.end),
    readGscClassRollup(sb, windows.prev28.start, windows.prev28.end),
    readGscClassRollup(sb, windows.cur7.start, windows.cur7.end),
    readGscClassRollup(sb, windows.prev7.start, windows.prev7.end),
  ])
  const err = cur28.error ?? prev28.error ?? cur7.error ?? prev7.error
  if (err) return unreadable(err)
  return buildGscTrend({
    anchor,
    windows,
    cur28: cur28.rows,
    prev28: prev28.rows,
    cur7: cur7.rows,
    prev7: prev7.rows,
    note: `store ${coverage.minDate}..${coverage.maxDate}; anchor ${anchor}`,
  })
}
