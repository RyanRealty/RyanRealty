/**
 * getCityYearPricing — the per-city-year detached-sale aggregate the approved
 * chart-room forms run on: median close, median $/sqft, median days-to-offer,
 * median sale-to-original-ask, new-construction share, closing count.
 *
 * reachability: entry-point — chart-room foundation (Unit F, 2026-08-19); the
 * Market page units land on it in the same rollout.
 *
 * MECHANISM. One call to the `city_year_pricing` RPC (migration
 * supabase/migrations/20260819090000_city_year_pricing_rpc.sql). The RPC
 * aggregates sale_pricing_facts (~149k rows, service-role only) server-side
 * with percentile_cont, so the DAL never pages the base table through
 * PostgREST and never recomputes a median in JS. The whole result — every
 * city, every year with >= MIN_CLOSINGS_PER_YEAR closings — is a few hundred
 * rows and is cached ONCE under one key; per-city and per-window reads filter
 * the cached pull, so one cache entry serves every page.
 *
 * Until the migration is applied the RPC errors, the fetch throws (never
 * cached — lib/data/cache/resilient.ts), and callers get the empty fallback:
 * a page renders its empty reason honestly instead of an invented series.
 *
 * §0: every row traces to sale_pricing_facts, product_class='detached',
 * close_price > 0, sqft >= 300, plausible-close ratio 0.1–10x of last ask,
 * grouped by city_slug x extract(year from close_date). The RPC's docblock is
 * the same trace in SQL.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

/** HAVING floor the RPC applies. A median of two sales is an anecdote. */
export const MIN_CLOSINGS_PER_YEAR = 3

export type CityYearPricingRow = {
  citySlug: string
  city: string
  year: number
  closings: number
  medianClose: number | null
  medianPpsf: number | null
  medianDaysToOffer: number | null
  medianSaleToOriginal: number | null
  newConstructionCount: number
  /** newConstructionCount / closings, null when closings is 0. */
  newConstructionShare: number | null
}

type CityYearPricingDbRow = {
  city_slug: string
  city: string
  year: number
  closings: number
  median_close: number | string | null
  median_ppsf: number | string | null
  median_days_to_offer: number | string | null
  median_sale_to_original: number | string | null
  new_construction_count: number
}

function toFiniteOrNull(value: number | string | null): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Pure row mapper, exported for unit tests. */
export function mapCityYearPricingRow(row: CityYearPricingDbRow): CityYearPricingRow | null {
  const citySlug = typeof row.city_slug === 'string' ? row.city_slug.trim() : ''
  const year = Number(row.year)
  const closings = Number(row.closings)
  if (!citySlug || !Number.isInteger(year) || !(closings > 0)) return null
  const newConstructionCount = Math.max(0, Number(row.new_construction_count) || 0)
  return {
    citySlug,
    city: typeof row.city === 'string' && row.city.trim() ? row.city.trim() : citySlug,
    year,
    closings,
    medianClose: toFiniteOrNull(row.median_close),
    medianPpsf: toFiniteOrNull(row.median_ppsf),
    medianDaysToOffer: toFiniteOrNull(row.median_days_to_offer),
    medianSaleToOriginal: toFiniteOrNull(row.median_sale_to_original),
    newConstructionCount,
    newConstructionShare: closings > 0 ? newConstructionCount / closings : null,
  }
}

/** Pure window/city filter, exported for unit tests. */
export function filterCityYearPricing(
  rows: readonly CityYearPricingRow[],
  opts: { citySlug?: string; fromYear?: number; toYear?: number } = {},
): CityYearPricingRow[] {
  const citySlug = opts.citySlug?.trim().toLowerCase()
  return rows.filter((r) => {
    if (citySlug && r.citySlug !== citySlug) return false
    if (opts.fromYear != null && r.year < opts.fromYear) return false
    if (opts.toYear != null && r.year > opts.toYear) return false
    return true
  })
}

async function fetchAllCityYearPricing(): Promise<CityYearPricingRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    throw new Error('getCityYearPricing: Supabase service environment is not set.')
  }
  const sb = createServiceClient()
  const { data, error } = await sb.rpc('city_year_pricing', {
    min_closings: MIN_CLOSINGS_PER_YEAR,
  })
  // Throw, never return [] on error: unstable_cache must not cache a blip
  // (or the not-yet-applied migration) as "no data exists".
  if (error) throw new Error(`city_year_pricing RPC failed: ${error.message}`)
  const rows = (data ?? []) as CityYearPricingDbRow[]
  const out: CityYearPricingRow[] = []
  for (const row of rows) {
    const mapped = mapCityYearPricingRow(row)
    if (mapped) out.push(mapped)
  }
  return out
}

/**
 * Every city x year cell, ascending by city then year. One cached pull.
 * Revalidates on the marketStats window (6h), matching the facts refresh.
 */
export const getAllCityYearPricing = makeResilientCached(
  fetchAllCityYearPricing,
  ['pricing-city-year-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'pricing-facts'],
  },
  [] as CityYearPricingRow[],
)

/** One city's years (or a year window across all cities). Filters the cached pull. */
export async function getCityYearPricing(
  opts: { citySlug?: string; fromYear?: number; toYear?: number } = {},
): Promise<CityYearPricingRow[]> {
  const all = await getAllCityYearPricing()
  return filterCityYearPricing(all, opts)
}
