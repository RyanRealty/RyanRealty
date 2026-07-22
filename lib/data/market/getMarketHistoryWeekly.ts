/**
 * getMarketHistoryWeekly — the weekly time series market_pulse_live cannot
 * provide (the pulse overwrites itself every refresh).
 *
 * Reads public.market_history_weekly, populated every Monday by
 * /api/cron/market-history-snapshot: per-geo local metrics frozen from the
 * pulse (active_count, new_count_7d, pending_count, price_reduction_share,
 * months_of_supply, median_list_price) plus national rate context under
 * geoType 'national' / geoSlug 'us' (mortgage_rate_30yr, treasury_10yr,
 * mortgage_treasury_spread). Every row carries `source` for the §0
 * verification trace.
 *
 * Fails soft: until migration 20260722020100_market_history_weekly.sql is
 * applied, the read errors (42P01 / PGRST205), which makeResilientCached never
 * caches — callers get [] and render their no-history state.
 */

import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached, readOrThrow } from '@/lib/data/cache/resilient'
import type { IsoDate, IsoTimestamp } from '@/lib/data/types/shared'

const InputSchema = z.object({
  // GeoType plus 'national' — the national context series lives in the same
  // table under geo_type='national', geo_slug='us'.
  geoType: z.enum(['city', 'neighborhood', 'community', 'subdivision', 'zip', 'region', 'national']),
  geoSlug: z.string().min(1).max(200),
  /** Optional metric filter; omit for every metric the geo has. */
  metrics: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
  // How many weeks back from today (default 52). Capped at 104 so a
  // full-metric geo (9 metrics x 104 weeks = 936 rows) stays under the
  // PostgREST 1000-row response cap in a single request.
  weeks: z.number().int().min(1).max(104).default(52),
})

export type GetMarketHistoryWeeklyInput = z.input<typeof InputSchema>

export type MarketHistoryWeeklyPoint = {
  weekStart: IsoDate
  metric: string
  value: number
  source: string
  capturedAt: IsoTimestamp
}

async function fetchMarketHistoryWeekly(input: GetMarketHistoryWeeklyInput): Promise<MarketHistoryWeeklyPoint[]> {
  const { geoType, geoSlug, metrics, weeks } = InputSchema.parse(input)

  const supabase = supabaseAnon()
  if (!supabase) return []

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - weeks * 7)
  const cutoffDate = cutoff.toISOString().slice(0, 10)

  // readOrThrow THROWS on a DB error (including 42P01 / PGRST205 before the
  // migration is applied) so a transient failure is never cached as an empty
  // history.
  const data = await readOrThrow(`getMarketHistoryWeekly(${geoType}:${geoSlug})`, () => {
    let query = supabase
      .from('market_history_weekly')
      .select('week_start, metric, value, source, captured_at')
      .eq('geo_type', geoType)
      .eq('geo_slug', geoSlug)
      .gte('week_start', cutoffDate)
    if (metrics && metrics.length > 0) query = query.in('metric', metrics)
    return query.order('week_start', { ascending: true }).limit(weeks * 20)
  })

  const rows = (data ?? []) as Array<Record<string, unknown>>
  return rows
    .map((row) => {
      const value = typeof row.value === 'number' ? row.value : Number(row.value)
      if (!Number.isFinite(value)) return null
      return {
        weekStart: String(row.week_start) as IsoDate,
        metric: String(row.metric),
        value,
        source: String(row.source ?? 'market_history_weekly'),
        capturedAt: String(row.captured_at ?? '') as IsoTimestamp,
      }
    })
    .filter((p): p is MarketHistoryWeeklyPoint => p !== null)
}

export const getMarketHistoryWeekly = makeResilientCached(
  fetchMarketHistoryWeekly,
  ['market-history-weekly-v1'],
  {
    // Weekly-cadence data — the 6h market-stats window is more than fresh
    // enough and keeps Monday's new rows visible the same day.
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market],
  },
  [],
)
