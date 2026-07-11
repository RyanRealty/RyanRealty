/**
 * CMA market context — verified conditions for the subject's city, pulled from
 * the cache tables (never aggregated from raw listings; CLAUDE.md database
 * rules). market_stats_cache rolling_365d supplies the closed-sale trend and
 * the YoY rate that drives the per-comp time adjustment; market_pulse_live
 * supplies live active inventory AND the canonical months of supply.
 *
 * Months of supply comes FROM market_pulse_live.months_of_supply — the §0
 * canonical figure (active / (closed_last_6_months / 6)) that every other
 * Ryan Realty surface publishes. A CMA must never tell a client a different
 * MoS/verdict than the website shows for the same city (found live 2026-07-10:
 * a bespoke 365-day-pace derivation said 3.7/seller's while the site said
 * 4.1/balanced). The 365-day derivation remains only as a fallback when the
 * pulse row is missing, and the citation records which source was used.
 * Verdict thresholds (CLAUDE.md §0): <= 4 seller's, 4-6 balanced, >= 6 buyer's.
 */

import { getCmaMarketStatsRow, getCmaMarketPulseRow } from '@/lib/data'
import type { CmaMarketContext } from '@/lib/cma/types'

function slugCandidates(city: string): string[] {
  const lower = city.trim().toLowerCase()
  const hyphen = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  // The cache historically carries both 'la-pine' and 'la pine' spellings.
  return Array.from(new Set([hyphen, lower]))
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function getCmaMarketContext(city: string): Promise<CmaMarketContext | null> {
  const candidates = slugCandidates(city)
  const [stats, pulse] = await Promise.all([
    getCmaMarketStatsRow(candidates),
    getCmaMarketPulseRow(candidates),
  ])
  if (!stats) return null

  const sold365 = num(stats.sold_count) ?? 0
  const active = num(pulse?.active_count)
  // Canonical MoS first (the published pulse figure), 365d-pace derivation only
  // when the pulse row is missing it. Keep the RAW (unrounded) value for the
  // verdict classification — rounding before binning flips a true 4.04 into a
  // seller's-market verdict (or 5.96 into a buyer's) that the number itself
  // contradicts. Display the rounded figure; classify off the raw one.
  let rawMonthsOfSupply = num(pulse?.months_of_supply)
  let mosFormula = 'market_pulse_live.months_of_supply (canonical: active / (closed_last_6_months / 6))'
  if (rawMonthsOfSupply == null && active != null && sold365 > 0) {
    rawMonthsOfSupply = active / (sold365 / 12)
    mosFormula = 'fallback: active_count / (sold_count_365 / 12) — pulse row missing'
  }
  const monthsOfSupply = rawMonthsOfSupply != null ? +rawMonthsOfSupply.toFixed(1) : null
  let verdict: CmaMarketContext['marketVerdict'] = null
  if (rawMonthsOfSupply != null) {
    verdict = rawMonthsOfSupply <= 4 ? 'seller' : rawMonthsOfSupply >= 6 ? 'buyer' : 'balanced'
  }

  return {
    geoSlug: stats.geo_slug,
    geoLabel: stats.geo_label ?? city,
    periodStart: stats.period_start,
    periodEnd: stats.period_end,
    soldCount365: sold365,
    medianSalePrice: num(stats.median_sale_price),
    medianDom: num(stats.median_dom),
    medianPpsf: num(stats.median_price_per_sqft_closed) ?? num(stats.median_ppsf),
    saleToListRatio: num(stats.avg_sale_to_list_ratio),
    yoyMedianPriceDeltaPct: num(stats.yoy_median_price_delta_pct),
    activeCount: active,
    pendingCount: num(pulse?.pending_count),
    monthsOfSupply,
    mosFormula,
    marketVerdict: verdict,
    methodologyVersion: stats.methodology_version,
    computedAt: stats.computed_at,
    pulseUpdatedAt: pulse?.updated_at ?? null,
  }
}
