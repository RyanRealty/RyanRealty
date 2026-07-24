/**
 * marketNarrativeWrites — read a real market_stats_cache row, generate a
 * deterministic §0-safe narrative from it, and persist to public.market_narratives
 * (W8.7 writer leg).
 *
 * §0: the narrative's numbers come from the cache row this reads (and the MoS
 * from market_pulse_live), never from raw listings and never fabricated. The
 * generated_from_stats_id column links each narrative back to the exact cache
 * row it was built from, so any published narrative is auditable to its source.
 */

import { supabaseAnon } from '@/lib/data/client'
import { createServiceClient } from '@/lib/supabase/service'
import { MARKET_REPORT_DEFAULT_CITIES } from '@/app/actions/market-report-types'
import { buildMarketNarrative, type NarrativeStats, type MarketNarrative } from '@/lib/data/market/market-narrative'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATS_COLS =
  'id, geo_type, geo_slug, geo_label, period_type, period_start, period_end, ' +
  'median_sale_price, sold_count, median_dom, avg_sale_to_list_ratio, median_ppsf, ' +
  'end_of_period_inventory, yoy_median_price_delta_pct, yoy_dom_change, yoy_inventory_change_pct'

/** Human period label for the narrative prose (e.g. "in June 2026"). */
function periodLabel(periodType: string, periodStart: string): string {
  const d = new Date(`${periodStart}T12:00:00Z`) // noon UTC so no timezone shifts the month
  // Month by index, not a date formatter: this is a single month NAME, not a
  // full date, so the shared formatDate (which always renders day + year) is the
  // wrong tool and produced "June 1, 2026 2026". A lookup is exact and TZ-proof.
  const month = MONTH_NAMES[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  if (periodType === 'monthly') return `in ${month} ${year}`
  if (periodType === 'ytd') return `year to date ${year}`
  if (periodType === 'quarterly') return `in Q${Math.floor(d.getUTCMonth() / 3) + 1} ${year}`
  return `this period`
}

export interface NarrativeWriteResult {
  ok: boolean
  geoSlug: string
  reason?: string
  narrative?: MarketNarrative
}

/**
 * Generate + store the narrative for one geo/period. Idempotent per
 * (geo_type, geo_slug, period_type, period_start). Never throws.
 */
export async function generateAndStoreMarketNarrative(input: {
  geoType: string
  geoSlug: string
  periodType: string
  periodStart: string
}): Promise<NarrativeWriteResult> {
  const { geoType, geoSlug, periodType, periodStart } = input
  try {
    const sb = supabaseAnon()
    if (!sb) return { ok: false, geoSlug, reason: 'supabase not configured' }

    const { data: stats } = await sb
      .from('market_stats_cache')
      .select(STATS_COLS)
      .eq('geo_type', geoType)
      .eq('geo_slug', geoSlug)
      .eq('period_type', periodType)
      .eq('period_start', periodStart)
      .maybeSingle()

    if (!stats) return { ok: false, geoSlug, reason: 'no stats row for this geo/period' }
    const s = stats as unknown as Record<string, unknown>

    // No sales in the window → no honest narrative to write (§0: don't invent).
    if (!Number(s.sold_count)) return { ok: false, geoSlug, reason: 'zero sales in period' }

    // Months of supply from the live pulse (it is not stored on the stats row).
    let monthsOfSupply: number | null = null
    const { data: pulse } = await sb
      .from('market_pulse_live')
      .select('months_of_supply')
      .eq('geo_type', geoType)
      .eq('geo_slug', geoSlug)
      .maybeSingle()
    const mos = (pulse as { months_of_supply?: number | null } | null)?.months_of_supply
    if (typeof mos === 'number' && Number.isFinite(mos)) monthsOfSupply = mos

    const narrativeStats: NarrativeStats = {
      geoLabel: (s.geo_label as string) || geoSlug,
      periodLabel: periodLabel(periodType, periodStart),
      medianSalePrice: (s.median_sale_price as number | null) ?? null,
      soldCount: Number(s.sold_count) || 0,
      medianDom: (s.median_dom as number | null) ?? null,
      avgSaleToListRatio: (s.avg_sale_to_list_ratio as number | null) ?? null,
      medianPpsf: (s.median_ppsf as number | null) ?? null,
      endOfPeriodInventory: (s.end_of_period_inventory as number | null) ?? null,
      yoyMedianPriceDeltaPct: (s.yoy_median_price_delta_pct as number | null) ?? null,
      yoyDomChange: (s.yoy_dom_change as number | null) ?? null,
      yoyInventoryChangePct: (s.yoy_inventory_change_pct as number | null) ?? null,
      monthsOfSupply,
    }

    const narrative = buildMarketNarrative(narrativeStats)

    const service = createServiceClient()
    const { error } = await service.from('market_narratives').upsert(
      {
        geo_type: geoType,
        geo_slug: geoSlug,
        period_type: periodType,
        period_start: periodStart,
        period_end: (s.period_end as string) ?? periodStart,
        overview: narrative.overview,
        price_analysis: narrative.priceAnalysis,
        speed_analysis: narrative.speedAnalysis,
        inventory_analysis: narrative.inventoryAnalysis,
        buyer_outlook: narrative.buyerOutlook,
        seller_outlook: narrative.sellerOutlook,
        faq: narrative.faq,
        generated_from_stats_id: (s.id as string) ?? null,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'geo_type,geo_slug,period_type,period_start' },
    )
    if (error) return { ok: false, geoSlug, reason: error.message }
    return { ok: true, geoSlug, narrative }
  } catch (err) {
    return { ok: false, geoSlug, reason: err instanceof Error ? err.message : 'narrative write failed' }
  }
}

/**
 * Generate + store narratives for every report city + region for a period
 * (defaults to the current month). Runs from the market-narratives cron. Uses
 * the canonical lower("City") space-form city slug (ci:market-city-slug-canon),
 * so a multi-word city resolves to real data. Never throws; returns per-geo results.
 */
export async function generateNarrativesForReportGeos(input?: {
  periodType?: string
  periodStart?: string
}): Promise<{ ok: number; skipped: number; results: NarrativeWriteResult[] }> {
  const periodType = input?.periodType ?? 'monthly'
  const now = new Date()
  const periodStart =
    input?.periodStart ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`

  const geos: Array<{ geoType: string; geoSlug: string }> = [
    ...MARKET_REPORT_DEFAULT_CITIES.map((name) => ({ geoType: 'city', geoSlug: name.toLowerCase() })),
    { geoType: 'region', geoSlug: 'central-oregon' },
  ]

  const results: NarrativeWriteResult[] = []
  for (const g of geos) {
    results.push(await generateAndStoreMarketNarrative({ ...g, periodType, periodStart }))
  }
  return {
    ok: results.filter((r) => r.ok).length,
    skipped: results.filter((r) => !r.ok).length,
    results,
  }
}
