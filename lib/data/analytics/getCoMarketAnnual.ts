/**
 * getCoMarketAnnual — CO service-area closed-sales annual metrics.
 *
 * Prefer analytics_mart_market_annual (post-migration rebuild).
 * Fallback: aggregate listings (cached 24h) — G62-safe (no details).
 *
 * §0: same closed CTE + service-area as EDA_FINDINGS_2026-08-10.md
 */
import 'server-only'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

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
  source: 'mart' | 'live_aggregate'
  computedAt: string
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const a = [...nums].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
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
  // Table missing → PostgREST error; treat as no mart
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

async function fetchLiveAggregate(
  year: number,
  typeScope: AnalyticsTypeScope,
): Promise<CoMarketAnnualRow> {
  const sb = supabaseAnon()
  if (!sb) {
    return {
      year,
      typeScope,
      soldCount: 0,
      totalVolume: 0,
      medianClose: null,
      meanClose: null,
      propertyTypeBreakdown: {},
      methodology: ANALYTICS_METHODOLOGY_V1,
      source: 'live_aggregate',
      computedAt: new Date().toISOString(),
    }
  }

  const prices: number[] = []
  const breakdown: Record<string, number> = {}
  let from = 0
  const page = 1000
  for (;;) {
    let q = sb
      .from('listings')
      .select('ClosePrice,PropertyType')
      .ilike('StandardStatus', '%Closed%')
      .gte('ClosePrice', 1000)
      .not('CloseDate', 'is', null)
      .in('City', [...ANALYTICS_CO_CITIES_PROPER])
      .gte('CloseDate', `${year}-01-01`)
      .lte('CloseDate', `${year}-12-31`)
      .order('ListingKey', { ascending: true })
      .range(from, from + page - 1)

    if (typeScope === 'sfr') q = q.eq('PropertyType', 'A')
    else if (typeScope === 'multi') q = q.in('PropertyType', ['B', 'C'])
    else if (typeScope === 'land') q = q.eq('PropertyType', 'D')
    else if (typeScope === 'other') q = q.not('PropertyType', 'in', '("A","B","C","D")')

    const { data, error } = await q
    if (error) throw new Error(`[getCoMarketAnnual live] ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      const p = Number(row.ClosePrice)
      if (!Number.isFinite(p)) continue
      // When typeScope is all, still collect; for filtered queries already filtered
      if (typeScope !== 'all') {
        prices.push(p)
      } else {
        prices.push(p)
        const t = (row.PropertyType as string) || 'unknown'
        breakdown[t] = (breakdown[t] || 0) + 1
      }
      if (typeScope !== 'all') {
        /* breakdown only for all */
      }
    }
    // Fix: for non-all scopes we still need breakdown empty
    if (data.length < page) break
    from += page
    if (from > 100000) break
  }

  // Re-scan breakdown only for all — already filled in loop for all
  if (typeScope !== 'all') {
    // empty breakdown ok
  }

  const soldCount = prices.length
  const totalVolume = prices.reduce((a, b) => a + b, 0)
  return {
    year,
    typeScope,
    soldCount,
    totalVolume,
    medianClose: median(prices),
    meanClose: soldCount ? totalVolume / soldCount : null,
    propertyTypeBreakdown: typeScope === 'all' ? breakdown : {},
    methodology: ANALYTICS_METHODOLOGY_V1,
    source: 'live_aggregate',
    computedAt: new Date().toISOString(),
  }
}

async function fetchCoMarketAnnual(input: {
  year: number
  typeScope?: AnalyticsTypeScope
}): Promise<CoMarketAnnualRow> {
  const year = z.number().int().min(1990).max(2100).parse(input.year)
  const typeScope = TypeScopeSchema.parse(input.typeScope ?? 'all')
  const mart = await fetchFromMart(year, typeScope)
  if (mart) return mart
  return fetchLiveAggregate(year, typeScope)
}

export const getCoMarketAnnual = makeResilientCached(
  fetchCoMarketAnnual,
  ['analytics-co-market-annual-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-market'],
  },
  {
    year: 0,
    typeScope: 'all' as AnalyticsTypeScope,
    soldCount: 0,
    totalVolume: 0,
    medianClose: null,
    meanClose: null,
    propertyTypeBreakdown: {},
    methodology: ANALYTICS_METHODOLOGY_V1,
    source: 'live_aggregate' as const,
    computedAt: new Date().toISOString(),
  },
)

/** Series helper — parallel year reads (each cached). */
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
  return rows.filter((r) => r.year > 0)
}
