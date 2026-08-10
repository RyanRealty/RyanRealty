/**
 * getCoAgentShare — top list/buy agents for CO closed sales (admin).
 */
import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

const SideSchema = z.enum(['list', 'buy'])

export type CoAgentShareRow = {
  rank: number
  agentName: string
  officeName: string
  sidesCount: number
  totalVolume: number
  volumeSharePct: number
}

export type CoAgentShareResult = {
  year: number
  side: 'list' | 'buy'
  marketVolume: number
  marketSoldCount: number
  rows: CoAgentShareRow[]
  methodology: string
  source: 'live_aggregate'
  computedAt: string
}

async function fetchCoAgentShare(input: {
  year: number
  side?: 'list' | 'buy'
  limit?: number
  officeName?: string
}): Promise<CoAgentShareResult> {
  const year = z.number().int().min(1995).max(2100).parse(input.year)
  const side = SideSchema.parse(input.side ?? 'list')
  const limit = z.number().int().min(5).max(100).parse(input.limit ?? 40)
  const officeFilter = input.officeName?.trim() || null

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
      marketVolume: 0,
      marketSoldCount: 0,
      rows: [],
      methodology: ANALYTICS_METHODOLOGY_V1,
      source: 'live_aggregate',
      computedAt: new Date().toISOString(),
    }
  }

  const map = new Map<string, { agent: string; office: string; n: number; vol: number }>()
  let marketN = 0
  let marketVol = 0
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await sb
      .from('listings')
      .select(
        'ClosePrice,ListOfficeName,ListAgentName,buyer_office_name,buyer_agent_name',
      )
      .ilike('StandardStatus', '%Closed%')
      .gte('ClosePrice', 1000)
      .not('CloseDate', 'is', null)
      .in('City', [...ANALYTICS_CO_CITIES_PROPER])
      .gte('CloseDate', `${year}-01-01`)
      .lte('CloseDate', `${year}-12-31`)
      .order('ListingKey', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(`[getCoAgentShare] ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      const p = Number(row.ClosePrice) || 0
      marketN++
      marketVol += p
      const agent =
        side === 'list'
          ? String(row.ListAgentName || '').trim()
          : String(row.buyer_agent_name || '').trim()
      const office =
        side === 'list'
          ? String(row.ListOfficeName || '').trim()
          : String(row.buyer_office_name || '').trim()
      if (!agent) continue
      if (officeFilter && office !== officeFilter) continue
      const key = `${agent}||${office}`
      const e = map.get(key) ?? { agent, office, n: 0, vol: 0 }
      e.n++
      e.vol += p
      map.set(key, e)
    }
    if (data.length < page) break
    from += page
    if (from > 100000) break
  }

  const rows = [...map.values()]
    .map((v) => ({
      agentName: v.agent,
      officeName: v.office,
      sidesCount: v.n,
      totalVolume: v.vol,
      volumeSharePct: marketVol ? (100 * v.vol) / marketVol : 0,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }))

  return {
    year,
    side,
    marketVolume: marketVol,
    marketSoldCount: marketN,
    rows,
    methodology: ANALYTICS_METHODOLOGY_V1,
    source: 'live_aggregate',
    computedAt: new Date().toISOString(),
  }
}

export const getCoAgentShare = makeResilientCached(
  fetchCoAgentShare,
  ['analytics-co-agent-share-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-agent-share'],
  },
  {
    year: 0,
    side: 'list' as const,
    marketVolume: 0,
    marketSoldCount: 0,
    rows: [],
    methodology: ANALYTICS_METHODOLOGY_V1,
    source: 'live_aggregate' as const,
    computedAt: new Date().toISOString(),
  },
)
