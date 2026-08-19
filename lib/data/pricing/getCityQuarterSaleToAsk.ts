/**
 * getCityQuarterSaleToAsk — per-city median sale-to-original-ask for ONE
 * quarter across every year it has enough closings, the read behind the
 * approved chart-room dumbbell (same quarter, prior year → current year).
 *
 * reachability: entry-point — Unit CITY (2026-08-19); the Bend city page's
 * sale-to-ask dumbbell reads the latest complete quarter pair from this.
 *
 * MECHANISM. One call to the `city_quarter_sale_to_ask` RPC (migration
 * supabase/migrations/20260819210000_city_quarter_sale_to_ask_rpc.sql), the
 * same shape as getCityYearPricing: the RPC aggregates sale_pricing_facts
 * (~149k rows, service-role only) server-side with percentile_cont, the whole
 * per-quarter result is a few hundred rows cached ONCE per quarter, and
 * page-side helpers filter the cached pull.
 *
 * §0: YoY is the same window across two years. This read exists so the
 * dumbbell never compares a complete prior year against a running partial —
 * `latestCompleteQuarter` names the newest quarter that has fully closed on
 * both sides of the pair.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

/** HAVING floor the RPC applies — the chart-room lock for this form. */
export const MIN_CLOSINGS_PER_QUARTER = 5

export type CityQuarterSaleToAskRow = {
  citySlug: string
  city: string
  year: number
  closings: number
  /** Ratio (0.9845 = 98.45% of original ask). */
  medianSaleToOriginal: number
}

type CityQuarterSaleToAskDbRow = {
  city_slug: string
  city: string
  year: number
  closings: number
  median_sale_to_original: number | string | null
}

/** Pure row mapper, exported for unit tests. */
export function mapCityQuarterSaleToAskRow(
  row: CityQuarterSaleToAskDbRow,
): CityQuarterSaleToAskRow | null {
  const citySlug = typeof row.city_slug === 'string' ? row.city_slug.trim() : ''
  const year = Number(row.year)
  const closings = Number(row.closings)
  const ratio = row.median_sale_to_original == null ? NaN : Number(row.median_sale_to_original)
  if (!citySlug || !Number.isInteger(year) || !(closings > 0)) return null
  if (!Number.isFinite(ratio) || ratio <= 0) return null
  return {
    citySlug,
    city: typeof row.city === 'string' && row.city.trim() ? row.city.trim() : citySlug,
    year,
    closings,
    medianSaleToOriginal: ratio,
  }
}

/**
 * The newest quarter that is COMPLETE as of `today` (its last day is past).
 * Pure, exported for unit tests. Returns quarter 1–4 and the year that
 * quarter last completed in.
 */
export function latestCompleteQuarter(today: Date): { quarter: number; year: number } {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth() // 0-11
  const runningQuarter = Math.floor(m / 3) + 1
  if (runningQuarter === 1) return { quarter: 4, year: y - 1 }
  return { quarter: runningQuarter - 1, year: y }
}

export type CityQuarterPair = {
  citySlug: string
  city: string
  quarter: number
  currentYear: number
  priorYear: number
  currentClosings: number
  priorClosings: number
  /** Ratios (0.9845 = 98.45%). */
  currentMedian: number
  priorMedian: number
}

/**
 * Pair each city's current-year row with its prior-year row for the same
 * quarter. Cities missing either side are dropped — a dumbbell needs both
 * ends. Pure, exported for unit tests.
 */
export function pairCityQuarterRows(
  rows: readonly CityQuarterSaleToAskRow[],
  opts: { quarter: number; currentYear: number },
): CityQuarterPair[] {
  const priorYear = opts.currentYear - 1
  const byCity = new Map<string, { current?: CityQuarterSaleToAskRow; prior?: CityQuarterSaleToAskRow }>()
  for (const row of rows) {
    const slot = byCity.get(row.citySlug) ?? {}
    if (row.year === opts.currentYear) slot.current = row
    if (row.year === priorYear) slot.prior = row
    byCity.set(row.citySlug, slot)
  }
  const pairs: CityQuarterPair[] = []
  for (const { current, prior } of byCity.values()) {
    if (!current || !prior) continue
    pairs.push({
      citySlug: current.citySlug,
      city: current.city,
      quarter: opts.quarter,
      currentYear: current.year,
      priorYear: prior.year,
      currentClosings: current.closings,
      priorClosings: prior.closings,
      currentMedian: current.medianSaleToOriginal,
      priorMedian: prior.medianSaleToOriginal,
    })
  }
  // Highest current ratio first — the chart-room sort for this form.
  pairs.sort((a, b) => b.currentMedian - a.currentMedian)
  return pairs
}

async function fetchCityQuarterSaleToAsk(quarter: number): Promise<CityQuarterSaleToAskRow[]> {
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error(`getCityQuarterSaleToAsk: quarter must be 1-4, got ${quarter}.`)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error('getCityQuarterSaleToAsk: Supabase service environment is not set.')
  }
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('city_quarter_sale_to_ask', {
    qtr: quarter,
    min_closings: MIN_CLOSINGS_PER_QUARTER,
  })
  // Throw, never return [] on error: unstable_cache must not cache a blip
  // (or the not-yet-applied migration) as "no data exists".
  if (error) throw new Error(`city_quarter_sale_to_ask RPC failed: ${error.message}`)
  const rows = (data ?? []) as CityQuarterSaleToAskDbRow[]
  const out: CityQuarterSaleToAskRow[] = []
  for (const row of rows) {
    const mapped = mapCityQuarterSaleToAskRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}

/**
 * Every city x year cell for one quarter. One cached pull per quarter,
 * revalidating on the marketStats window (6h) like the facts refresh.
 */
export const getCityQuarterSaleToAsk = makeResilientCached(
  fetchCityQuarterSaleToAsk,
  ['pricing-city-quarter-sale-to-ask-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'pricing-facts'],
  },
  [] as CityQuarterSaleToAskRow[],
)
