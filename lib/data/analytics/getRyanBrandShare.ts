/**
 * getRyanBrandShare — Ryan Realty family share (list + buy) for CO closed sales (I4).
 *
 * Methodology:
 *   - Alias set from analytics_dim_office (is_ryan_realty) when present,
 *     else data/analytics/office-brand-aliases.json (is_ryan_realty groups).
 *   - Sum string-level office mart rows (or live ListOfficeName / buyer_office_name)
 *     whose office name matches any Ryan alias (exact or normalized).
 *   - Share % = Ryan volume / market volume from market mart or live market totals.
 *
 * Does NOT invent share numbers. Admin-only competitive desk.
 * See docs/plans/seo-voice/DIM_OFFICE_ENTITY_RESOLUTION.md § I4.
 */
import 'server-only'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

export type RyanSideShare = {
  side: 'list' | 'buy'
  sidesCount: number
  totalVolume: number
  volumeSharePct: number
  unitSharePct: number
  /** Distinct raw MLS office strings that matched the alias set */
  matchedOfficeNames: string[]
  marketSoldCount: number
  marketVolume: number
}

export type RyanBrandShareResult = {
  year: number
  canonicalName: string
  aliases: string[]
  list: RyanSideShare
  buy: RyanSideShare
  methodology: string
  source: 'mart' | 'live_aggregate'
  aliasSource: 'dim_office' | 'json_catalog' | 'fallback_regex'
  computedAt: string
}

function normKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function emptySide(side: 'list' | 'buy', marketN = 0, marketVol = 0): RyanSideShare {
  return {
    side,
    sidesCount: 0,
    totalVolume: 0,
    volumeSharePct: 0,
    unitSharePct: 0,
    matchedOfficeNames: [],
    marketSoldCount: marketN,
    marketVolume: marketVol,
  }
}

type AliasPack = {
  canonicalName: string
  aliases: string[]
  aliasSource: RyanBrandShareResult['aliasSource']
}

function loadJsonAliases(): AliasPack | null {
  try {
    const path = join(process.cwd(), 'data/analytics/office-brand-aliases.json')
    const catalog = JSON.parse(readFileSync(path, 'utf8')) as {
      groups?: Array<{
        canonical_name?: string
        is_ryan_realty?: boolean
        aliases?: string[]
      }>
    }
    const groups = (catalog.groups || []).filter((g) => g.is_ryan_realty)
    if (!groups.length) return null
    const aliases = new Set<string>()
    let canonical = 'Ryan Realty LLC'
    for (const g of groups) {
      if (g.canonical_name) {
        canonical = g.canonical_name
        aliases.add(g.canonical_name)
      }
      for (const a of g.aliases || []) {
        if (a?.trim()) aliases.add(a.trim())
      }
    }
    return {
      canonicalName: canonical,
      aliases: [...aliases],
      aliasSource: 'json_catalog',
    }
  } catch {
    return null
  }
}

async function loadRyanAliases(): Promise<AliasPack> {
  let sb
  try {
    sb = createServiceClient()
  } catch {
    sb = supabaseAnon()
  }
  if (sb) {
    const { data, error } = await sb
      .from('analytics_dim_office')
      .select('canonical_name,aliases,is_ryan_realty')
      .eq('is_ryan_realty', true)
    if (!error && data?.length) {
      const aliases = new Set<string>()
      let canonical = 'Ryan Realty LLC'
      for (const row of data) {
        if (row.canonical_name) {
          canonical = row.canonical_name as string
          aliases.add(row.canonical_name as string)
        }
        for (const a of (row.aliases as string[]) || []) {
          if (a?.trim()) aliases.add(a.trim())
        }
      }
      if (aliases.size) {
        return {
          canonicalName: canonical,
          aliases: [...aliases],
          aliasSource: 'dim_office',
        }
      }
    }
  }

  const fromJson = loadJsonAliases()
  if (fromJson) return fromJson

  return {
    canonicalName: 'Ryan Realty LLC',
    aliases: ['Ryan Realty LLC', 'Ryan Realty', 'Ryan Realty, LLC', 'Ryan Realty Inc', 'Ryan Realty Inc.'],
    aliasSource: 'fallback_regex',
  }
}

function buildMatcher(
  aliases: string[],
  allowFamilyRegex: boolean,
): (name: string) => boolean {
  const exact = new Set(aliases.map((a) => a.toLowerCase()))
  const norms = new Set(aliases.map(normKey))
  return (name: string): boolean => {
    const n = String(name || '').trim()
    if (!n) return false
    if (exact.has(n.toLowerCase())) return true
    if (norms.has(normKey(n))) return true
    return allowFamilyRegex ? /ryan\s*realty/i.test(n) : false
  }
}

async function marketTotals(
  year: number,
): Promise<{ n: number; vol: number; source: 'mart' | 'none' }> {
  const sb = supabaseAnon()
  if (!sb) return { n: 0, vol: 0, source: 'none' }
  const { data, error } = await sb
    .from('analytics_mart_market_annual')
    .select('sold_count,total_volume')
    .eq('geo_type', 'region')
    .eq('geo_slug', 'central-oregon')
    .eq('year', year)
    .eq('type_scope', 'all')
    .maybeSingle()
  if (error || !data) return { n: 0, vol: 0, source: 'none' }
  return {
    n: Number(data.sold_count) || 0,
    vol: Number(data.total_volume) || 0,
    source: 'mart',
  }
}

async function shareFromMart(
  year: number,
  side: 'list' | 'buy',
  isMatch: (name: string) => boolean,
  marketN: number,
  marketVol: number,
): Promise<RyanSideShare | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data, error } = await sb
    .from('analytics_mart_office_share_annual')
    .select('office_name,sides_count,total_volume')
    .eq('geo_type', 'region')
    .eq('geo_slug', 'central-oregon')
    .eq('year', year)
    .eq('type_scope', 'all')
    .eq('side', side)
    .limit(2000)
  if (error || !data?.length) return null

  let sidesCount = 0
  let totalVolume = 0
  const matched: string[] = []
  for (const row of data) {
    const name = String(row.office_name || '').trim()
    if (!isMatch(name)) continue
    matched.push(name)
    sidesCount += Number(row.sides_count) || 0
    totalVolume += Number(row.total_volume) || 0
  }

  let mN = marketN
  let mVol = marketVol
  if (!mN || !mVol) {
    mN = data.reduce((a, r) => a + (Number(r.sides_count) || 0), 0)
    mVol = data.reduce((a, r) => a + (Number(r.total_volume) || 0), 0)
  }

  return {
    side,
    sidesCount,
    totalVolume,
    volumeSharePct: mVol ? (100 * totalVolume) / mVol : 0,
    unitSharePct: mN ? (100 * sidesCount) / mN : 0,
    matchedOfficeNames: matched.sort(),
    marketSoldCount: mN,
    marketVolume: mVol,
  }
}

async function shareFromLive(
  year: number,
  isMatch: (name: string) => boolean,
): Promise<{ list: RyanSideShare; buy: RyanSideShare }> {
  let sb
  try {
    sb = createServiceClient()
  } catch {
    sb = supabaseAnon()
  }
  if (!sb) {
    return { list: emptySide('list'), buy: emptySide('buy') }
  }

  let marketN = 0
  let marketVol = 0
  const listMap = new Map<string, { n: number; vol: number }>()
  const buyMap = new Map<string, { n: number; vol: number }>()
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
    if (error) throw new Error(`[getRyanBrandShare] ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      const p = Number(row.ClosePrice) || 0
      marketN++
      marketVol += p
      const listName = String(row.ListOfficeName || '').trim()
      if (listName && isMatch(listName)) {
        const e = listMap.get(listName) ?? { n: 0, vol: 0 }
        e.n++
        e.vol += p
        listMap.set(listName, e)
      }
      const buyName = String(row.buyer_office_name || '').trim()
      if (buyName && isMatch(buyName)) {
        const e = buyMap.get(buyName) ?? { n: 0, vol: 0 }
        e.n++
        e.vol += p
        buyMap.set(buyName, e)
      }
    }
    if (data.length < page) break
    from += page
    if (from > 100000) break
  }

  function pack(
    side: 'list' | 'buy',
    map: Map<string, { n: number; vol: number }>,
  ): RyanSideShare {
    let sidesCount = 0
    let totalVolume = 0
    const matched: string[] = []
    for (const [name, v] of map) {
      matched.push(name)
      sidesCount += v.n
      totalVolume += v.vol
    }
    return {
      side,
      sidesCount,
      totalVolume,
      volumeSharePct: marketVol ? (100 * totalVolume) / marketVol : 0,
      unitSharePct: marketN ? (100 * sidesCount) / marketN : 0,
      matchedOfficeNames: matched.sort(),
      marketSoldCount: marketN,
      marketVolume: marketVol,
    }
  }

  return {
    list: pack('list', listMap),
    buy: pack('buy', buyMap),
  }
}

async function fetchRyanBrandShare(input: { year: number }): Promise<RyanBrandShareResult> {
  const year = z.number().int().min(1995).max(2100).parse(input.year)
  const pack = await loadRyanAliases()
  const isMatch = buildMatcher(pack.aliases, pack.aliasSource === 'fallback_regex')
  const market = await marketTotals(year)

  const listMart = await shareFromMart(year, 'list', isMatch, market.n, market.vol)
  const buyMart = await shareFromMart(year, 'buy', isMatch, market.n, market.vol)

  if (listMart && buyMart) {
    return {
      year,
      canonicalName: pack.canonicalName,
      aliases: pack.aliases,
      list: listMart,
      buy: buyMart,
      methodology: `${ANALYTICS_METHODOLOGY_V1}; ryan_brand_alias_rollup_v1`,
      source: 'mart',
      aliasSource: pack.aliasSource,
      computedAt: new Date().toISOString(),
    }
  }

  const live = await shareFromLive(year, isMatch)
  return {
    year,
    canonicalName: pack.canonicalName,
    aliases: pack.aliases,
    list: live.list,
    buy: live.buy,
    methodology: `${ANALYTICS_METHODOLOGY_V1}; ryan_brand_alias_rollup_v1`,
    source: 'live_aggregate',
    aliasSource: pack.aliasSource,
    computedAt: new Date().toISOString(),
  }
}

export const getRyanBrandShare = makeResilientCached(
  fetchRyanBrandShare,
  ['analytics-ryan-brand-share-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-ryan-brand-share'],
  },
  {
    year: 0,
    canonicalName: 'Ryan Realty LLC',
    aliases: [],
    list: emptySide('list'),
    buy: emptySide('buy'),
    methodology: ANALYTICS_METHODOLOGY_V1,
    source: 'live_aggregate' as const,
    aliasSource: 'fallback_regex' as const,
    computedAt: new Date().toISOString(),
  },
)
