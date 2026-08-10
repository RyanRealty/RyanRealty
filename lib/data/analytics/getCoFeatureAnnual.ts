/**
 * getCoFeatureAnnual — CO closed-sales amenity / feature cubes (H6).
 *
 * Prefer analytics_mart_feature_annual (post H6 rebuild).
 * Fallback: live aggregate over typed columns only (no details JSONB).
 *
 * feature_key allowlist (§0 — real columns only; high-fill on CO closed):
 *   fireplace   → fireplace_yn IS TRUE OR fireplaces_total > 0
 *   garage      → garage_yn IS TRUE
 *   association → association_yn IS TRUE (HOA)
 */
import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

const FeatureKeySchema = z.enum(['fireplace', 'garage', 'association'])
export type CoFeatureKey = z.infer<typeof FeatureKeySchema>

export const CO_FEATURE_KEYS: readonly CoFeatureKey[] = ['fireplace', 'garage', 'association']

export const CO_FEATURE_LABELS: Record<CoFeatureKey, string> = {
  fireplace: 'Fireplace',
  garage: 'Garage',
  association: 'HOA / association',
}

export type CoFeatureAnnualRow = {
  featureKey: CoFeatureKey
  soldCount: number
  totalVolume: number
  medianClose: number | null
  meanClose: number | null
  marketSoldCount: number
  marketVolume: number
  unitSharePct: number | null
  volumeSharePct: number | null
}

export type CoFeatureAnnualResult = {
  year: number
  typeScope: 'all'
  rows: CoFeatureAnnualRow[]
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

function hasFeature(
  row: {
    fireplace_yn?: boolean | null
    fireplaces_total?: number | null
    garage_yn?: boolean | null
    association_yn?: boolean | null
  },
  key: CoFeatureKey,
): boolean {
  if (key === 'fireplace') {
    return row.fireplace_yn === true || Number(row.fireplaces_total) > 0
  }
  if (key === 'garage') return row.garage_yn === true
  if (key === 'association') return row.association_yn === true
  return false
}

async function fetchFromMart(year: number): Promise<CoFeatureAnnualResult | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data, error } = await sb
    .from('analytics_mart_feature_annual')
    .select(
      'feature_key,sold_count,total_volume,median_close,mean_close,market_sold_count,market_volume,unit_share_pct,volume_share_pct,methodology,computed_at',
    )
    .eq('geo_type', 'region')
    .eq('geo_slug', 'central-oregon')
    .eq('year', year)
    .eq('type_scope', 'all')
    .in('feature_key', [...CO_FEATURE_KEYS])
  if (error || !data?.length) return null

  const rows: CoFeatureAnnualRow[] = []
  for (const key of CO_FEATURE_KEYS) {
    const r = data.find((d) => d.feature_key === key)
    if (!r) continue
    rows.push({
      featureKey: key,
      soldCount: r.sold_count as number,
      totalVolume: Number(r.total_volume),
      medianClose: r.median_close != null ? Number(r.median_close) : null,
      meanClose: r.mean_close != null ? Number(r.mean_close) : null,
      marketSoldCount: Number(r.market_sold_count) || 0,
      marketVolume: Number(r.market_volume) || 0,
      unitSharePct: r.unit_share_pct != null ? Number(r.unit_share_pct) : null,
      volumeSharePct: r.volume_share_pct != null ? Number(r.volume_share_pct) : null,
    })
  }
  if (!rows.length) return null

  return {
    year,
    typeScope: 'all',
    rows,
    methodology: (data[0]?.methodology as string) || `${ANALYTICS_METHODOLOGY_V1}+feature_typed_v1`,
    source: 'mart',
    computedAt: (data[0]?.computed_at as string) || new Date().toISOString(),
  }
}

async function fetchLive(year: number): Promise<CoFeatureAnnualResult> {
  let sb
  try {
    sb = createServiceClient()
  } catch {
    sb = supabaseAnon()
  }
  if (!sb) {
    return {
      year,
      typeScope: 'all',
      rows: [],
      methodology: `${ANALYTICS_METHODOLOGY_V1}+feature_typed_v1`,
      source: 'live_aggregate',
      computedAt: new Date().toISOString(),
    }
  }

  const byKey: Record<CoFeatureKey, number[]> = {
    fireplace: [],
    garage: [],
    association: [],
  }
  const marketPrices: number[] = []
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await sb
      .from('listings')
      .select('ClosePrice,fireplace_yn,fireplaces_total,garage_yn,association_yn')
      .ilike('StandardStatus', '%Closed%')
      .gte('ClosePrice', 1000)
      .not('CloseDate', 'is', null)
      .in('City', [...ANALYTICS_CO_CITIES_PROPER])
      .gte('CloseDate', `${year}-01-01`)
      .lte('CloseDate', `${year}-12-31`)
      .order('ListingKey', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(`[getCoFeatureAnnual] ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      const p = Number(row.ClosePrice)
      if (!Number.isFinite(p)) continue
      marketPrices.push(p)
      for (const key of CO_FEATURE_KEYS) {
        if (hasFeature(row, key)) byKey[key].push(p)
      }
    }
    if (data.length < page) break
    from += page
    if (from > 100000) break
  }

  const marketN = marketPrices.length
  const marketVol = marketPrices.reduce((a, b) => a + b, 0)
  const rows: CoFeatureAnnualRow[] = CO_FEATURE_KEYS.map((key) => {
    const prices = byKey[key]
    const vol = prices.reduce((a, b) => a + b, 0)
    return {
      featureKey: key,
      soldCount: prices.length,
      totalVolume: vol,
      medianClose: median(prices),
      meanClose: prices.length ? vol / prices.length : null,
      marketSoldCount: marketN,
      marketVolume: marketVol,
      unitSharePct: marketN ? (100 * prices.length) / marketN : null,
      volumeSharePct: marketVol ? (100 * vol) / marketVol : null,
    }
  })

  return {
    year,
    typeScope: 'all',
    rows,
    methodology: `${ANALYTICS_METHODOLOGY_V1}+feature_typed_v1`,
    source: 'live_aggregate',
    computedAt: new Date().toISOString(),
  }
}

async function fetchCoFeatureAnnual(input: {
  year: number
}): Promise<CoFeatureAnnualResult> {
  const year = z.number().int().min(1995).max(2100).parse(input.year)
  const mart = await fetchFromMart(year)
  if (mart) return mart
  return fetchLive(year)
}

export const getCoFeatureAnnual = makeResilientCached(
  fetchCoFeatureAnnual,
  ['analytics-co-feature-annual-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-feature-annual'],
  },
  {
    year: 0,
    typeScope: 'all' as const,
    rows: [],
    methodology: `${ANALYTICS_METHODOLOGY_V1}+feature_typed_v1`,
    source: 'live_aggregate' as const,
    computedAt: new Date().toISOString(),
  },
)
