/**
 * market-report-freshness — hold a report whose data has stopped refreshing.
 *
 * A market report states the market "as of" the day it goes out. If the job
 * that refreshes a source has stopped, the numbers are older than the email
 * says, and a cadence send would mail them to a client anyway. So the sender
 * checks every clock the printed figures came from, and a report with any
 * stale source is HELD (not sent) and recorded as held with the stale sources
 * named (CLAUDE.md §0: a figure that cannot be verified does not ship).
 *
 * THE THRESHOLD, AND WHY IT IS 30 HOURS (measured 2026-09-29, not assumed).
 * docs/DATABASE_FOR_AI_AGENTS.md says market_stats_cache refreshes every six
 * hours. The live schedule says otherwise, and the threshold has to follow the
 * schedule that actually runs:
 *   - market_stats_cache: vercel.json runs /api/cron/refresh-market-stats at
 *     `0 7 * * *`, once a day. The bend-larkspur rolling_365d row was stamped
 *     2026-09-29 07:01 UTC and not again that day; city rows are also touched
 *     by the post-sync pipeline (Bend 22:30 UTC the same day).
 *   - market_metric (Market Truth, the twelve-month figures and a city's live
 *     inventory and months of supply): computed once a day at about 06:21 UTC
 *     (the Bend detached active_count cell, 2026-09-19 through 2026-09-29),
 *     with an occasional extra run.
 *   - A neighborhood's live inventory is Market Truth's active_count too,
 *     read directly (getDetachedInventories), so its clock is a market_metric
 *     clock (daily, as above). The 15-minute pulse is not read for a report:
 *     its own count includes Coming Soon.
 * The slowest source a report prints is therefore a DAILY job. A healthy row is
 * at most about 24 hours old at any send tick. 30 hours is one daily cycle plus
 * a 6-hour grace for a slow or re-run job, so an ordinary day never holds, and
 * a single missed daily run does: by the 16:00 UTC send tick after a missed
 * 07:00 run, the row is about 33 hours old. It is a dead-job detector, not a
 * precision bound.
 *
 * If the doc's six hours were used instead, every neighborhood report checked
 * after 20:00 UTC (13 hours past the 07:00 cache run) would read as stale on
 * an ordinary day.
 *
 * Pure: no I/O. The sender passes `now`.
 */

import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'

/** Max age of any source clock before a report is held. See the file comment. */
export const MARKET_DATA_MAX_AGE_HOURS = 30

export type StaleSource = {
  area: string
  source: 'market_stats_cache' | 'market_metric'
  asOf: string | null
  ageHours: number | null
}

function ageHours(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.round(((nowMs - t) / 3_600_000) * 10) / 10
}

/**
 * Every source clock behind the blocks that is older than the threshold, or
 * missing where the block prints a figure from that source. Empty = fresh.
 *
 * A block with no provenance (a legacy caller that built it by hand) is not
 * checked here; the sender always fetches through getMarketReportData, which
 * attaches it.
 */
export function findStaleSources(
  blocks: readonly MarketReportAreaBlock[],
  now: Date = new Date(),
  maxAgeHours: number = MARKET_DATA_MAX_AGE_HOURS,
): StaleSource[] {
  const nowMs = now.getTime()
  const out: StaleSource[] = []
  const check = (area: string, source: StaleSource['source'], iso: string | null | undefined) => {
    const age = ageHours(iso, nowMs)
    if (age == null || age > maxAgeHours) out.push({ area, source, asOf: iso ?? null, ageHours: age })
  }
  for (const b of blocks) {
    const p = b.provenance
    if (!p) continue
    // The rolling_365d row prints median days on market and keeps the area in
    // the report at all.
    if (b.domMedian != null || p.cache) check(b.slug, 'market_stats_cache', p.cache?.updatedAt ?? null)
    // The live inventory (and a city's months of supply).
    if (p.live && (b.activeListings != null || b.monthsOfSupply != null)) {
      check(b.slug, p.live.table, p.live.computedAt)
    }
    // The twelve-month Market Truth cells, when the block printed any of them.
    if (b.twelveMonthSource === 'market-truth' && p.twelveMonth) {
      const cells = [p.twelveMonth.medianClose, p.twelveMonth.closedCount, p.twelveMonth.yoyMedian].filter(
        (c): c is NonNullable<typeof c> => c != null,
      )
      if (cells.length > 0) {
        const oldest = cells
          .map((c) => c.computedAt)
          .filter(Boolean)
          .sort()[0]
        check(b.slug, 'market_metric', oldest ?? null)
      }
    }
  }
  return out
}

/** One line for a held row's detail: which source, how old. */
export function describeStaleSources(stale: readonly StaleSource[]): string {
  return stale
    .map((s) => `${s.area} ${s.source} ${s.asOf ?? 'no timestamp'}${s.ageHours != null ? ` (${s.ageHours}h old)` : ''}`)
    .join('; ')
}
