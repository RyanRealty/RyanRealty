/**
 * getCoMarketAnnual — CO service-area closed-sales annual metrics.
 *
 * Reads analytics_mart_market_annual only. A missing mart row is missing.
 * Do not scan `listings` on the request path (cube lock, 2026-08-14).
 *
 * §0: same closed CTE + service-area as EDA_FINDINGS_2026-08-10.md
 */
import 'server-only'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

const TypeScopeSchema = z.enum(['all', 'sfr', 'multi', 'land', 'other'])
export type AnalyticsTypeScope = z.infer<typeof TypeScopeSchema>

export type CoMarketAnnualRow = {
  year: number
  typeScope: AnalyticsTypeScope
  soldCount: number
  totalVolume: number
  medianClose: number | null
  meanClose: number | null
  propertyTypeBreakdown: Record<string, number>
  methodology: string
  source: 'mart' | 'missing'
  computedAt: string
}

function emptyRow(
  year: number,
  typeScope: AnalyticsTypeScope,
  source: CoMarketAnnualRow['source'] = 'missing',
): CoMarketAnnualRow {
  return {
    year,
    typeScope,
    soldCount: 0,
    totalVolume: 0,
    medianClose: null,
    meanClose: null,
    propertyTypeBreakdown: {},
    methodology: ANALYTICS_METHODOLOGY_V1,
    source,
    computedAt: '',
  }
}

async function fetchFromMart(
  year: number,
  typeScope: AnalyticsTypeScope,
): Promise<CoMarketAnnualRow | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data, error } = await sb
    .from('analytics_mart_market_annual')
    .select(
      'year,type_scope,sold_count,total_volume,median_close,mean_close,property_type_breakdown,methodology,computed_at',
    )
    .eq('geo_type', 'region')
    .eq('geo_slug', 'central-oregon')
    .eq('year', year)
    .eq('type_scope', typeScope)
    .maybeSingle()
  if (error || !data) return null
  return {
    year: data.year as number,
    typeScope: data.type_scope as AnalyticsTypeScope,
    soldCount: data.sold_count as number,
    totalVolume: Number(data.total_volume),
    medianClose: data.median_close != null ? Number(data.median_close) : null,
    meanClose: data.mean_close != null ? Number(data.mean_close) : null,
    propertyTypeBreakdown: (data.property_type_breakdown as Record<string, number>) ?? {},
    methodology: (data.methodology as string) || ANALYTICS_METHODOLOGY_V1,
    source: 'mart',
    computedAt: data.computed_at as string,
  }
}

async function fetchCoMarketAnnual(input: {
  year: number
  typeScope?: AnalyticsTypeScope
}): Promise<CoMarketAnnualRow> {
  const year = z.number().int().min(1990).max(2100).parse(input.year)
  const typeScope = TypeScopeSchema.parse(input.typeScope ?? 'all')
  const mart = await fetchFromMart(year, typeScope)
  return mart ?? emptyRow(year, typeScope)
}

export const getCoMarketAnnual = makeResilientCached(
  fetchCoMarketAnnual,
  ['analytics-co-market-annual-v2'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-market'],
  },
  emptyRow(0, 'all'),
)

/** Series helper — parallel year reads (each cached). Years with no mart row stay out. */
export async function getCoMarketAnnualSeries(opts: {
  fromYear: number
  toYear: number
  typeScope?: AnalyticsTypeScope
}): Promise<CoMarketAnnualRow[]> {
  const from = opts.fromYear
  const to = opts.toYear
  const years: number[] = []
  for (let y = from; y <= to; y++) years.push(y)
  const rows = await Promise.all(
    years.map((year) => getCoMarketAnnual({ year, typeScope: opts.typeScope ?? 'all' })),
  )
  return rows.filter((r) => r.year > 0 && r.soldCount > 0 && r.source === 'mart')
}
