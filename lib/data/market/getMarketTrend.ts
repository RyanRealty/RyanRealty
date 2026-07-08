/**
 * getMarketTrend — the monthly trend sequence for one geo, read from
 * `public.market_stats_cache` (period_type='monthly').
 *
 * Serves the email chart endpoint (app/api/email/market-chart) and the
 * market-report email's month-over-month context lines. Unlike getPriceHistory
 * (price + sold count only), this returns the wider monthly projection the
 * email needs: median sale price, sold count, median DOM, and end-of-period
 * inventory — all confirmed-existing cache columns (see getCityMarketDetail).
 *
 * §0 discipline: cache rows only, never raw `listings`. The CURRENT calendar
 * month's row is EXCLUDED — it is an in-progress window whose median over a
 * handful of closings would put a misleading cliff at the end of every chart
 * and a fabricated-looking "this month" figure in the email. Consumers only
 * ever see completed months.
 *
 * Cache: 6h resilient window matching the cache-table refresh cadence, same
 * poison-null-safe pattern as getPriceHistory (fetch THROWS on a DB error so
 * a transient blip is never cached as an empty chart).
 */

import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { GeoType } from '@/lib/data/types/shared'

export type MarketTrendPoint = {
  /** ISO date the monthly period starts (first of the month). */
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
  medianDom: number | null
  endOfPeriodInventory: number | null
}

const InputSchema = z.object({
  geoType: z.enum(['region', 'city', 'community', 'neighborhood', 'zip', 'subdivision']),
  geoSlug: z.string().min(1).max(200),
  months: z.number().int().min(3).max(36).default(12),
})

type Row = {
  period_start: string
  median_sale_price: number | null
  sold_count: number | null
  median_dom: number | null
  end_of_period_inventory: number | null
}

/** True when the ISO date falls in the current UTC calendar month. */
export function isCurrentMonth(isoDate: string, now: Date = new Date()): boolean {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return false
  return (
    d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
  )
}

async function fetchTrend(
  geoType: GeoType,
  geoSlug: string,
  months: number,
): Promise<MarketTrendPoint[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  // +1 so dropping the in-progress current month still yields `months` points.
  const { data, error } = await sb
    .from('market_stats_cache')
    .select('period_start, median_sale_price, sold_count, median_dom, end_of_period_inventory')
    .eq('geo_type', geoType)
    .eq('geo_slug', geoSlug)
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: false })
    .limit(months + 1)
  // THROW on a transient DB error so the resilient cache never stores an empty
  // series (a cached empty would blank the email charts for the whole window).
  if (error) {
    throw new Error(
      `[getMarketTrend] ${geoType}:${geoSlug} ${error.message ?? JSON.stringify(error)}`,
    )
  }
  return ((data ?? []) as Row[])
    .filter((r) => !isCurrentMonth(r.period_start))
    .slice(0, months)
    .map((r) => ({
      periodStart: r.period_start,
      medianSalePrice: r.median_sale_price,
      soldCount: r.sold_count,
      medianDom: r.median_dom,
      endOfPeriodInventory: r.end_of_period_inventory,
    }))
    .reverse()
}

const cachedTrend = makeResilientCached(
  fetchTrend,
  ['market-trend-v1'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market] },
  [],
)

/** Monthly trend points, oldest → newest, completed months only. */
export const getMarketTrend = (
  geoType: GeoType,
  geoSlug: string,
  months = 12,
): Promise<MarketTrendPoint[]> => {
  InputSchema.parse({ geoType, geoSlug, months })
  return cachedTrend(geoType, geoSlug, months)
}
