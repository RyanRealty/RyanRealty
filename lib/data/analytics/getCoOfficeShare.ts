/**
 * getCoOfficeShare — CO closed-sales office rankings (list or buy side).
 * Mart-first; live aggregate fallback. Authenticated admin surfaces only for now.
 */
import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

const SideSchema = z.enum(['list', 'buy'])
export type OfficeShareSide = z.infer<typeof SideSchema>

export type CoOfficeShareRow = {
  rank: number
  officeName: string
  sidesCount: number
  totalVolume: number
  volumeSharePct: number
  unitSharePct: number
}

export type CoOfficeShareResult = {
  year: number
  side: OfficeShareSide
  marketSoldCount: number
  marketVolume: number
  rows: CoOfficeShareRow[]
  methodology: string
  source: 'mart' | 'live_aggregate'
  computedAt: string
}

async function fetchFromMart(
  year: number,
  side: OfficeShareSide,
  limit: number,
): Promise<CoOfficeShareResult | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data, error } = await sb
    .from('analytics_mart_office_share_annual')
    .select(
      'office_name,sides_count,total_volume,volume_share_pct,unit_share_pct,rank_volume,methodology,computed_at',
    )
    .eq('geo_type', 'region')
    .eq('geo_slug', 'central-oregon')
    .eq('year', year)
    .eq('type_scope', 'all')
    .eq('side', side)
    .order('rank_volume', { ascending: true })
    .limit(limit)
  if (error || !data?.length) return null

  const marketVolume = data.reduce((a, r) => a + Number(r.total_volume), 0)
  // market totals from share math: first row unit share inverse is fragile; sum sides
  const marketSoldCount = data.reduce((a, r) => a + Number(r.sides_count), 0)
  // Better: use volume_share of rank1 — actually sum of unit shares should be ~100 if full table
  // For mart full table we need total from market mart; approximate from sum if limit is full
  return {
    year,
    side,
    marketSoldCount,
    marketVolume,
    rows: data.map((r) => ({
      rank: r.rank_volume as number,
      officeName: r.office_name as string,
      sidesCount: r.sides_count as number,
      totalVolume: Number(r.total_volume),
      volumeSharePct: Number(r.volume_share_pct),
      unitSharePct: Number(r.unit_share_pct),
    })),
    methodology: (data[0]?.methodology as string) || ANALYTICS_METHODOLOGY_V1,
    source: 'mart',
    computedAt: (data[0]?.computed_at as string) || new Date().toISOString(),
  }
}

async function fetchLive(
  year: number,
  side: OfficeShareSide,
  limit: number,
): Promise<CoOfficeShareResult> {
  // Service role for larger scans in admin; falls back to anon
  let sb
  try {
    sb = createServiceClient()
  } catch {
    sb = supabaseAnon()
  }
  if (!sb) {
    return {
      year,
      side,
      marketSoldCount: 0,
      marketVolume: 0,
      rows: [],
      methodology: ANALYTICS_METHODOLOGY_V1,
      source: 'live_aggregate',
      computedAt: new Date().toISOString(),
    }
  }

  const map = new Map<string, { n: number; vol: number }>()
  let marketN = 0
  let marketVol = 0
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await sb
      .from('listings')
      .select('ClosePrice,ListOfficeName,buyer_office_name')
      .ilike('StandardStatus', '%Closed%')
      .gte('ClosePrice', 1000)
      .not('CloseDate', 'is', null)
      .in('City', [...ANALYTICS_CO_CITIES_PROPER])
      .gte('CloseDate', `${year}-01-01`)
      .lte('CloseDate', `${year}-12-31`)
      .order('ListingKey', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(`[getCoOfficeShare] ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      const p = Number(row.ClosePrice) || 0
      marketN++
      marketVol += p
      const name =
        side === 'list'
          ? String(row.ListOfficeName || '').trim()
          : String(row.buyer_office_name || '').trim()
      if (!name) continue
      const e = map.get(name) ?? { n: 0, vol: 0 }
      e.n++
      e.vol += p
      map.set(name, e)
    }
    if (data.length < page) break
    from += page
    if (from > 100000) break
  }

  const ranked = [...map.entries()]
    .map(([officeName, v]) => ({
      officeName,
      sidesCount: v.n,
      totalVolume: v.vol,
      volumeSharePct: marketVol ? (100 * v.vol) / marketVol : 0,
      unitSharePct: marketN ? (100 * v.n) / marketN : 0,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }))

  return {
    year,
    side,
    marketSoldCount: marketN,
    marketVolume: marketVol,
    rows: ranked,
    methodology: ANALYTICS_METHODOLOGY_V1,
    source: 'live_aggregate',
    computedAt: new Date().toISOString(),
  }
}

async function fetchCoOfficeShare(input: {
  year: number
  side?: OfficeShareSide
  limit?: number
}): Promise<CoOfficeShareResult> {
  const year = z.number().int().min(1995).max(2100).parse(input.year)
  const side = SideSchema.parse(input.side ?? 'list')
  const limit = z.number().int().min(5).max(200).parse(input.limit ?? 50)
  const mart = await fetchFromMart(year, side, limit)
  if (mart) return mart
  return fetchLive(year, side, limit)
}

export const getCoOfficeShare = makeResilientCached(
  fetchCoOfficeShare,
  ['analytics-co-office-share-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-office-share'],
  },
  {
    year: 0,
    side: 'list' as OfficeShareSide,
    marketSoldCount: 0,
    marketVolume: 0,
    rows: [],
    methodology: ANALYTICS_METHODOLOGY_V1,
    source: 'live_aggregate' as const,
    computedAt: new Date().toISOString(),
  },
)
