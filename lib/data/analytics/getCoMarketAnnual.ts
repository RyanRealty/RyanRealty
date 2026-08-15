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

export type AnalyticsGeoType = 'region' | 'city'

export type CoMarketAnnualRow = {
  geoType: AnalyticsGeoType
  geoSlug: string
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
  geoType: AnalyticsGeoType = 'region',
  geoSlug = 'central-oregon',
): CoMarketAnnualRow {
  return {
    geoType,
    geoSlug,
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

async function fetchFromMart(input: {
  year: number
  typeScope: AnalyticsTypeScope
  geoType: AnalyticsGeoType
  geoSlug: string
}): Promise<CoMarketAnnualRow | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data, error } = await sb
    .from('analytics_mart_market_annual')
    .select(
      'geo_type,geo_slug,year,type_scope,sold_count,total_volume,median_close,mean_close,property_type_breakdown,methodology,computed_at',
    )
    .eq('geo_type', input.geoType)
    .eq('geo_slug', input.geoSlug)
    .eq('year', input.year)
    .eq('type_scope', input.typeScope)
    .maybeSingle()
  if (error || !data) return null
  return {
    geoType: data.geo_type as AnalyticsGeoType,
    geoSlug: data.geo_slug as string,
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

async function fetchCoMarketAnnualAt(input: {
  year: number
  typeScope?: AnalyticsTypeScope
  geoType?: AnalyticsGeoType
  geoSlug?: string
}): Promise<CoMarketAnnualRow> {
  const year = z.number().int().min(1990).max(2100).parse(input.year)
  const typeScope = TypeScopeSchema.parse(input.typeScope ?? 'all')
  const geoType = input.geoType === 'city' ? 'city' : 'region'
  const geoSlug = (input.geoSlug ?? 'central-oregon').trim() || 'central-oregon'
  const mart = await fetchFromMart({ year, typeScope, geoType, geoSlug })
  return mart ?? emptyRow(year, typeScope, 'missing', geoType, geoSlug)
}

/** Region Central Oregon. Prefer getCoMarketAnnualAt for a city grain. */
export const getCoMarketAnnual = makeResilientCached(
  (input: { year: number; typeScope?: AnalyticsTypeScope }) =>
    fetchCoMarketAnnualAt({
      year: input.year,
      typeScope: input.typeScope,
      geoType: 'region',
      geoSlug: 'central-oregon',
    }),
  ['analytics-co-market-annual-v2'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-market'],
  },
  emptyRow(0, 'all'),
)

/** City or region cell. Missing row is missing. No listings scan. */
export const getCoMarketAnnualAt = makeResilientCached(
  fetchCoMarketAnnualAt,
  ['analytics-co-market-annual-geo-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-market'],
  },
  emptyRow(0, 'all'),
)

/** Cube floor. Heartbeat fails if this region-all cell is missing. */
export const MART_FLOOR_YEAR = 1998

/** Last full year the public hub leads with. Not `new Date()`. */
export const MART_HEADLINE_YEAR = 2024

export async function assertMartFloorYear(): Promise<{
  ok: boolean
  year: number
  soldCount: number
  source: CoMarketAnnualRow['source']
}> {
  const row = await getCoMarketAnnual({ year: MART_FLOOR_YEAR, typeScope: 'all' })
  return {
    ok: row.source === 'mart' && row.soldCount > 0,
    year: MART_FLOOR_YEAR,
    soldCount: row.soldCount,
    source: row.source,
  }
}

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
