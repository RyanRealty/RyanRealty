/**
 * CMA market context — verified conditions for the subject's city, pulled from
 * the cache tables (never aggregated from raw listings; CLAUDE.md database
 * rules). market_stats_cache rolling_365d supplies the closed-sale trend and
 * the YoY rate that drives the per-comp time adjustment; market_pulse_live
 * supplies live active inventory for months of supply.
 *
 * Months of supply = active_count / (sold_count_365 / 12).
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
  let monthsOfSupply: number | null = null
  if (active != null && sold365 > 0) {
    monthsOfSupply = +(active / (sold365 / 12)).toFixed(1)
  }
  let verdict: CmaMarketContext['marketVerdict'] = null
  if (monthsOfSupply != null) {
    verdict = monthsOfSupply <= 4 ? 'seller' : monthsOfSupply >= 6 ? 'buyer' : 'balanced'
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
    marketVerdict: verdict,
    methodologyVersion: stats.methodology_version,
    computedAt: stats.computed_at,
    pulseUpdatedAt: pulse?.updated_at ?? null,
  }
}
