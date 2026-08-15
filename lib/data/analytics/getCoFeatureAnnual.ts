/**
 * getCoFeatureAnnual — CO closed-sales amenity / feature cubes (H6).
 *
 * Reads analytics_mart_feature_annual only. A missing mart year is missing.
 * Do not scan `listings` on the request path (cube lock, 2026-08-14).
 *
 * feature_key allowlist (§0 — real columns only; high-fill on CO closed):
 *   fireplace   → fireplace_yn IS TRUE OR fireplaces_total > 0
 *   garage      → garage_yn IS TRUE
 *   association → association_yn IS TRUE (HOA)
 */
import 'server-only'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

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
  source: 'mart' | 'missing'
  computedAt: string
}

function emptyResult(year: number): CoFeatureAnnualResult {
  return {
    year,
    typeScope: 'all',
    rows: [],
    methodology: `${ANALYTICS_METHODOLOGY_V1}+feature_typed_v1`,
    source: 'missing',
    computedAt: '',
  }
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
    computedAt: (data[0]?.computed_at as string) || '',
  }
}

async function fetchCoFeatureAnnual(input: {
  year: number
}): Promise<CoFeatureAnnualResult> {
  const year = z.number().int().min(1995).max(2100).parse(input.year)
  const mart = await fetchFromMart(year)
  return mart ?? emptyResult(year)
}

export const getCoFeatureAnnual = makeResilientCached(
  fetchCoFeatureAnnual,
  ['analytics-co-feature-annual-v2'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-feature-annual'],
  },
  emptyResult(0),
)
