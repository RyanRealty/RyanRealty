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

  if (error || !data) {
    // Non-fatal: return fallbacks so calculators still render.
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

  return {
    mortgageRate: numOrFallback('mortgage_rate', FALLBACKS.mortgageRate),
    taxRatePct: numOrFallback('default_tax_rate_pct', FALLBACKS.taxRatePct),
    insuranceRatePct: numOrFallback('insurance_rate_pct', FALLBACKS.insuranceRatePct),
  }
}

export const getCalculatorDefaults = unstable_cache(
  _getCalculatorDefaults,
  ['calculator-defaults'],
  { revalidate: 6 * 60 * 60, tags: ['app_config'] },
)
