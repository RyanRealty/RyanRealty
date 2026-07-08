/**
 * getCalculatorDefaults — reads app_config rows that feed calculator defaults.
 *
 * Keys read:
 *   mortgage_rate        → current 30-yr fixed rate (number, e.g. 6.875)
 *   default_tax_rate_pct → Deschutes County property-tax rate as a % of value (e.g. 0.75)
 *   insurance_rate_pct   → annual homeowners insurance as a % of value (e.g. 0.30)
 *
 * Falls back to the hardcoded defaults below if the row is absent or the DB
 * is unreachable, so calculators always render with a sensible value.
 *
 * Cached 6 hours (rates change rarely; aligns with market_stats_cache freshness).
 */

import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'

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

async function _getCalculatorDefaults(): Promise<CalculatorDefaults> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('app_config')
    .select('key, value')
    .in('key', ['mortgage_rate', 'default_tax_rate_pct', 'insurance_rate_pct'])

  if (error || !data) { // poison-null-ok — deliberate fallback; calculators render with hardcoded rates
    return FALLBACKS
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
    mortgageRate: asPercent(numOrFallback('mortgage_rate', FALLBACKS.mortgageRate), 1, 2, 20, FALLBACKS.mortgageRate),
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
