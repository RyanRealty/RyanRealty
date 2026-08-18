/**
 * getCalculatorDefaults — the numbers every public payment figure is built on.
 *
 * THE 30-YR RATE COMES FROM THE INGESTED SERIES, NOT A HAND-TYPED ROW.
 * `market_history_weekly` (geo national/us, metric `mortgage_rate_30yr`,
 * source `freddie:pmms30`) is refreshed every Monday by
 * /api/cron/market-history-snapshot. `app_config.mortgage_rate` is a
 * hand-maintained row with no writer — on 2026-08-17 it still held 6.5 from
 * April while the ingested series carried 6.67 for that week. The live figure
 * was already in the database and nothing public read it. That is exactly the
 * drift a single statistics source exists to stop, so the precedence is:
 *
 *   1. market_history_weekly  — ingested, dated, carries its own §0 source
 *   2. app_config             — legacy hand-entered row, kept only as a floor
 *   3. FALLBACKS              — last resort so a calculator always renders
 *
 * Tax and insurance rates have no ingested equivalent yet and still read
 * app_config.
 *
 * WHO STILL DEPENDS ON app_config.mortgage_rate (audited 2026-08-17 against
 * the live DB catalog — routine bodies, view defs, column defaults/generation
 * expressions, check constraints, triggers, RLS policies, index expressions):
 *   - THIS function, and only this function, in the whole JS tree. It is the
 *     floor under the ingested rate, so the row is NOT dead and must not be
 *     removed: delete the read and a dark history series drops the calculators
 *     straight to the 7% hardcoded FALLBACK instead of the last hand-entered
 *     value.
 *   - `public.compute_and_cache_period_stats()` — reads the row directly (NOT
 *     via get_mortgage_rate()), defaults to 0.065, and writes
 *     `market_stats_cache.affordability_monthly_piti`. Still on the stale row.
 *   - `public.build_cache_methodology()` — stamps the row's value into the
 *     methodology JSONB on cache rows. Still on the stale row.
 *   - NOT `get_mortgage_rate()`. It still exists and still reads this row, but
 *     it has zero callers anywhere: nothing in the catalog references it and no
 *     code calls it as an RPC. It is left in place only because PostgREST
 *     exposes it publicly (EXECUTE granted to anon/authenticated/public), so an
 *     unseen external caller cannot be ruled out from inside the repo.
 *
 * A previous version of this comment claimed `listings.estimated_monthly_piti`
 * was a SQL generated column fed by `get_mortgage_rate()`. It is neither: the
 * column is plain (no default, no generation expression) and is written by
 * `lib/listing-mapper.ts`, which hardcodes its own 0.065 rate at sync time.
 * Those three — the two cache routines and the mapper constant — are separate
 * divergent rate paths and are NOT touched here.
 *
 * Cached 6 hours; the underlying series moves weekly.
 */

import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { getMarketHistoryWeekly } from '@/lib/data/market/getMarketHistoryWeekly'

export type CalculatorDefaults = {
  /** 30-yr fixed mortgage rate, e.g. 6.875 */
  mortgageRate: number
  /** Property tax rate as percent of purchase price, e.g. 0.75 */
  taxRatePct: number
  /** Homeowners insurance as percent of purchase price per year, e.g. 0.30 */
  insuranceRatePct: number
}

// Hardcoded fallbacks used when app_config rows are absent.
// Keep these in sync with the actual current values by updating app_config;
// these are the last-resort floor, not a display default.
const FALLBACKS: CalculatorDefaults = {
  mortgageRate: 7,
  taxRatePct: 0.75,
  insuranceRatePct: 0.30,
}

/**
 * Newest ingested 30-yr fixed rate, or null when the series has no usable
 * point. Returns null rather than throwing so a missing series degrades to the
 * legacy row instead of taking the calculators down.
 */
async function latestIngestedMortgageRate(): Promise<number | null> {
  try {
    const points = await getMarketHistoryWeekly({
      geoType: 'national',
      geoSlug: 'us',
      metrics: ['mortgage_rate_30yr'],
      weeks: 12,
    })
    if (!points.length) return null
    const newest = points.reduce((a, b) => (b.weekStart > a.weekStart ? b : a))
    return Number.isFinite(newest.value) && newest.value > 0 ? newest.value : null
  } catch {
    return null
  }
}

async function _getCalculatorDefaults(): Promise<CalculatorDefaults> {
  const sb = createServiceClient()
  const ingestedRate = await latestIngestedMortgageRate()
  const { data, error } = await sb
    .from('app_config')
    .select('key, value')
    .in('key', ['mortgage_rate', 'default_tax_rate_pct', 'insurance_rate_pct'])

  if (error || !data) { // poison-null-ok — deliberate fallback; calculators still render
    // app_config is unreachable, but an ingested rate is independent of it and
    // is the better number anyway — do not discard it here.
    return { ...FALLBACKS, mortgageRate: ingestedRate ?? FALLBACKS.mortgageRate }
  }

  const byKey: Record<string, unknown> = {}
  for (const row of data) {
    byKey[row.key] = row.value
  }

  function numOrFallback(key: string, fallback: number): number {
    const v = byKey[key]
    if (v === null || v === undefined) return fallback
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }

  // The contract here is PERCENT units (6.5 = 6.5%), but the app_config rows
  // were written as decimal fractions (0.065). Normalize + clamp so a sub-1%
  // "30-yr rate" can never feed the calculators again (it rendered $1,126/mo
  // on a $400K loan — ~2.8x under the honest figure).
  function asPercent(n: number, fractionCeiling: number, min: number, max: number, fallback: number): number {
    const pct = n < fractionCeiling ? n * 100 : n
    return pct >= min && pct <= max ? pct : fallback
  }

  return {
    // A real 30-yr rate is 2–20%; anything below 1 is a stored fraction.
    // The ingested series wins; the hand-entered row is only the floor under it.
    // Both run through asPercent so a bad value from either source is caught.
    mortgageRate: asPercent(
      ingestedRate ?? numOrFallback('mortgage_rate', FALLBACKS.mortgageRate),
      1,
      2,
      20,
      FALLBACKS.mortgageRate,
    ),
    // Property tax runs ~0.3–2.5% of value; stored fractions land below 0.1.
    taxRatePct: asPercent(numOrFallback('default_tax_rate_pct', FALLBACKS.taxRatePct), 0.1, 0.1, 3, FALLBACKS.taxRatePct),
    // Homeowners insurance runs ~0.1–1% of value per year.
    insuranceRatePct: asPercent(numOrFallback('insurance_rate_pct', FALLBACKS.insuranceRatePct), 0.1, 0.1, 1.5, FALLBACKS.insuranceRatePct),
  }
}

export const getCalculatorDefaults = unstable_cache(
  _getCalculatorDefaults,
  ['calculator-defaults'],
  { revalidate: 6 * 60 * 60, tags: ['app_config'] },
)
