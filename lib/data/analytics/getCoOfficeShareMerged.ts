/**
 * getCoOfficeShareMerged — brand-family / office-entity rollup of CO office share (I1).
 *
 * Methodology (`office_share_merged_v1`):
 *   1. Load full string-level mart rows (analytics_mart_office_share_annual).
 *   2. Join office_name → analytics_dim_office via mart.office_id (when set) OR
 *      exact/normalized match on canonical_name ∪ aliases.
 *   3. Group by brand_family (advisory franchise umbrella) or office_entity
 *      (one office_id / canonical). Unmatched strings stay singletons.
 *   4. Share % = sum(group sides|volume) / market totals from market mart.
 *
 * Does NOT invent volume or share. Brand-family merge is strategy-grade /
 * advisory — independent franchise offices remain separate legal entities.
 * Admin-only (I6). See docs/plans/seo-voice/DIM_OFFICE_ENTITY_RESOLUTION.md § I1.
 */
import 'server-only'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { supabaseAnon } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

const SideSchema = z.enum(['list', 'buy'])
const MergeModeSchema = z.enum(['brand_family', 'office_entity'])

export type OfficeShareSide = z.infer<typeof SideSchema>
export type OfficeShareMergeMode = z.infer<typeof MergeModeSchema>

export type CoOfficeShareMergedRow = {
  rank: number
  /** Brand family label, canonical office name, or raw MLS string */
  label: string
  brandFamily: string | null
  officeId: string | null
  sidesCount: number
  totalVolume: number
  volumeSharePct: number
  unitSharePct: number
  /** Distinct mart office_name strings rolled into this group */
  memberOfficeNames: string[]
  memberCount: number
}

export type CoOfficeShareMergedResult = {
  year: number
  side: OfficeShareSide
  mergeMode: OfficeShareMergeMode
  marketSoldCount: number
  marketVolume: number
  rows: CoOfficeShareMergedRow[]
  methodology: string
  source: 'mart' | 'live_aggregate'
  /** Fraction of mart side-rows whose office_name matched dim (0–1) */
  dimMatchRate: number
  unmatchedOfficeCount: number
  computedAt: string
}

type DimOffice = {
  office_id: string
  canonical_name: string
  brand_family: string | null
  aliases: string[]
}

type MartOfficeRow = {
  office_name: string | null
  office_id: string | null
  sides_count: number | null
  total_volume: number | null
}

function normKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

type BrandRule = { pattern: string; brand_family: string }

function loadBrandFamilyRules(): BrandRule[] {
  try {
    const path = join(process.cwd(), 'data/analytics/office-brand-aliases.json')
    const catalog = JSON.parse(readFileSync(path, 'utf8')) as {
      brand_family_rules?: BrandRule[]
    }
    return catalog.brand_family_rules || []
  } catch {
    return []
  }
}

function brandFamilyFromRules(name: string, rules: BrandRule[]): string | null {
  const n = String(name || '')
  for (const rule of rules) {
    try {
      if (new RegExp(rule.pattern, 'i').test(n)) return rule.brand_family
    } catch {
      // skip bad pattern
    }
  }
  return null
}

function emptyResult(
  year: number,
  side: OfficeShareSide,
  mergeMode: OfficeShareMergeMode,
  source: 'mart' | 'live_aggregate' = 'live_aggregate',
): CoOfficeShareMergedResult {
  return {
    year,
    side,
    mergeMode,
    marketSoldCount: 0,
    marketVolume: 0,
    rows: [],
    methodology: `${ANALYTICS_METHODOLOGY_V1}; office_share_merged_v1`,
    source,
    dimMatchRate: 0,
    unmatchedOfficeCount: 0,
    computedAt: new Date().toISOString(),
  }
}

async function marketTotals(
  year: number,
): Promise<{ n: number; vol: number }> {
  const sb = supabaseAnon()
  if (!sb) return { n: 0, vol: 0 }
  const { data, error } = await sb
    .from('analytics_mart_market_annual')
    .select('sold_count,total_volume')
    .eq('geo_type', 'region')
    .eq('geo_slug', 'central-oregon')
    .eq('year', year)
    .eq('type_scope', 'all')
    .maybeSingle()
  if (error || !data) return { n: 0, vol: 0 }
  return {
    n: Number(data.sold_count) || 0,
    vol: Number(data.total_volume) || 0,
  }
}

async function loadDimOffices(): Promise<DimOffice[]> {
  let sb
  try {
    sb = createServiceClient()
  } catch {
    sb = supabaseAnon()
  }
  if (!sb) return []

  const { rows, error } = await fetchPagedRows<{
    office_id: string
    canonical_name: string
    brand_family: string | null
    aliases: string[] | null
  }>((from, to) =>
    sb
      .from('analytics_dim_office')
      .select('office_id,canonical_name,brand_family,aliases')
      .order('canonical_name', { ascending: true })
      .range(from, to),
  )
  if (error) throw new Error(`[getCoOfficeShareMerged] dim_office: ${error.message}`)
  return rows.map((r) => ({
    office_id: r.office_id,
    canonical_name: r.canonical_name,
    brand_family: r.brand_family,
    aliases: (r.aliases || []).filter(Boolean),
  }))
}

/** Build office_name (exact + normalized) → dim lookup; plus office_id → dim. */
function buildDimIndex(dims: DimOffice[]): {
  byExact: Map<string, DimOffice>
  byNorm: Map<string, DimOffice>
  byId: Map<string, DimOffice>
} {
  const byExact = new Map<string, DimOffice>()
  const byNorm = new Map<string, DimOffice>()
  const byId = new Map<string, DimOffice>()

  for (const d of dims) {
    byId.set(d.office_id, d)
    const names = [d.canonical_name, ...d.aliases]
    for (const n of names) {
      const t = String(n || '').trim()
      if (!t) continue
      const el = t.toLowerCase()
      if (!byExact.has(el)) byExact.set(el, d)
      const nk = normKey(t)
      if (nk && !byNorm.has(nk)) byNorm.set(nk, d)
    }
  }
  return { byExact, byNorm, byId }
}

function resolveDim(
  officeName: string,
  officeId: string | null,
  index: ReturnType<typeof buildDimIndex>,
): DimOffice | null {
  if (officeId && index.byId.has(officeId)) {
    return index.byId.get(officeId) ?? null
  }
  const t = officeName.trim()
  if (!t) return null
  return (
    index.byExact.get(t.toLowerCase()) ??
    index.byNorm.get(normKey(t)) ??
    null
  )
}

type GroupAcc = {
  label: string
  brandFamily: string | null
  officeId: string | null
  sidesCount: number
  totalVolume: number
  members: Set<string>
}

function rollupRows(
  martRows: MartOfficeRow[],
  dims: DimOffice[],
  mergeMode: OfficeShareMergeMode,
  marketN: number,
  marketVol: number,
  limit: number,
): {
  rows: CoOfficeShareMergedRow[]
  dimMatchRate: number
  unmatchedOfficeCount: number
} {
  const index = buildDimIndex(dims)
  const rules = loadBrandFamilyRules()
  const groups = new Map<string, GroupAcc>()
  let matched = 0
  let total = 0
  const unmatchedNames = new Set<string>()

  for (const row of martRows) {
    const name = String(row.office_name || '').trim()
    if (!name) continue
    total++
    const sides = Number(row.sides_count) || 0
    const vol = Number(row.total_volume) || 0
    const dim = resolveDim(name, row.office_id, index)
    if (dim) matched++
    else unmatchedNames.add(name)

    let groupKey: string
    let label: string
    let brandFamily: string | null = null
    let officeId: string | null = null

    if (mergeMode === 'office_entity') {
      if (dim) {
        groupKey = `oid:${dim.office_id}`
        label = dim.canonical_name
        brandFamily = dim.brand_family
        officeId = dim.office_id
      } else {
        groupKey = `raw:${name}`
        label = name
      }
    } else {
      // brand_family (default strategy view)
      const fromDim = dim?.brand_family?.trim() || null
      const fromRules = fromDim ? null : brandFamilyFromRules(name, rules)
      brandFamily = fromDim || fromRules
      if (brandFamily) {
        groupKey = `bf:${brandFamily.toLowerCase()}`
        label = brandFamily
        officeId = null // multi-office family
      } else if (dim) {
        // dim match but no family → still entity-level singleton with canonical label
        groupKey = `oid:${dim.office_id}`
        label = dim.canonical_name
        officeId = dim.office_id
      } else {
        groupKey = `raw:${name}`
        label = name
      }
    }

    const g = groups.get(groupKey) ?? {
      label,
      brandFamily,
      officeId,
      sidesCount: 0,
      totalVolume: 0,
      members: new Set<string>(),
    }
    g.sidesCount += sides
    g.totalVolume += vol
    g.members.add(name)
    // Prefer non-null brand when accumulating
    if (!g.brandFamily && brandFamily) g.brandFamily = brandFamily
    groups.set(groupKey, g)
  }

  let mN = marketN
  let mVol = marketVol
  if (!mN || !mVol) {
    // Fallback: sum of all mart rows for this side (full table, not top-N)
    mN = martRows.reduce((a, r) => a + (Number(r.sides_count) || 0), 0)
    mVol = martRows.reduce((a, r) => a + (Number(r.total_volume) || 0), 0)
  }

  const ranked = [...groups.values()]
    .map((g) => ({
      label: g.label,
      brandFamily: g.brandFamily,
      officeId: g.officeId,
      sidesCount: g.sidesCount,
      totalVolume: g.totalVolume,
      volumeSharePct: mVol ? (100 * g.totalVolume) / mVol : 0,
      unitSharePct: mN ? (100 * g.sidesCount) / mN : 0,
      memberOfficeNames: [...g.members].sort(),
      memberCount: g.members.size,
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, ...r }))

  return {
    rows: ranked,
    dimMatchRate: total ? matched / total : 0,
    unmatchedOfficeCount: unmatchedNames.size,
  }
}

async function loadMartRows(
  year: number,
  side: OfficeShareSide,
): Promise<MartOfficeRow[] | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { rows, error } = await fetchPagedRows<MartOfficeRow>((from, to) =>
    sb
      .from('analytics_mart_office_share_annual')
      .select('office_name,office_id,sides_count,total_volume')
      .eq('geo_type', 'region')
      .eq('geo_slug', 'central-oregon')
      .eq('year', year)
      .eq('type_scope', 'all')
      .eq('side', side)
      .order('office_name', { ascending: true })
      .range(from, to),
  )
  if (error) throw new Error(`[getCoOfficeShareMerged] mart: ${error.message}`)
  if (!rows.length) return null
  return rows
}

async function loadLiveRows(
  year: number,
  side: OfficeShareSide,
): Promise<{ rows: MartOfficeRow[]; marketN: number; marketVol: number }> {
  let sb
  try {
    sb = createServiceClient()
  } catch {
    sb = supabaseAnon()
  }
  if (!sb) return { rows: [], marketN: 0, marketVol: 0 }

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
    if (error) throw new Error(`[getCoOfficeShareMerged] live: ${error.message}`)
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

  const rows: MartOfficeRow[] = [...map.entries()].map(([office_name, v]) => ({
    office_name,
    office_id: null,
    sides_count: v.n,
    total_volume: v.vol,
  }))
  return { rows, marketN, marketVol }
}

async function fetchCoOfficeShareMerged(input: {
  year: number
  side?: OfficeShareSide
  mergeMode?: OfficeShareMergeMode
  limit?: number
}): Promise<CoOfficeShareMergedResult> {
  const year = z.number().int().min(1995).max(2100).parse(input.year)
  const side = SideSchema.parse(input.side ?? 'list')
  const mergeMode = MergeModeSchema.parse(input.mergeMode ?? 'brand_family')
  const limit = z.number().int().min(5).max(200).parse(input.limit ?? 50)

  const [dims, market, martRows] = await Promise.all([
    loadDimOffices(),
    marketTotals(year),
    loadMartRows(year, side),
  ])

  if (martRows) {
    const rolled = rollupRows(
      martRows,
      dims,
      mergeMode,
      market.n,
      market.vol,
      limit,
    )
    return {
      year,
      side,
      mergeMode,
      marketSoldCount: market.n || martRows.reduce((a, r) => a + (Number(r.sides_count) || 0), 0),
      marketVolume: market.vol || martRows.reduce((a, r) => a + (Number(r.total_volume) || 0), 0),
      rows: rolled.rows,
      methodology: `${ANALYTICS_METHODOLOGY_V1}; office_share_merged_v1; mode=${mergeMode}`,
      source: 'mart',
      dimMatchRate: rolled.dimMatchRate,
      unmatchedOfficeCount: rolled.unmatchedOfficeCount,
      computedAt: new Date().toISOString(),
    }
  }

  const live = await loadLiveRows(year, side)
  if (!live.rows.length) {
    return emptyResult(year, side, mergeMode, 'live_aggregate')
  }
  const rolled = rollupRows(
    live.rows,
    dims,
    mergeMode,
    live.marketN,
    live.marketVol,
    limit,
  )
  return {
    year,
    side,
    mergeMode,
    marketSoldCount: live.marketN,
    marketVolume: live.marketVol,
    rows: rolled.rows,
    methodology: `${ANALYTICS_METHODOLOGY_V1}; office_share_merged_v1; mode=${mergeMode}`,
    source: 'live_aggregate',
    dimMatchRate: rolled.dimMatchRate,
    unmatchedOfficeCount: rolled.unmatchedOfficeCount,
    computedAt: new Date().toISOString(),
  }
}

export const getCoOfficeShareMerged = makeResilientCached(
  fetchCoOfficeShareMerged,
  ['analytics-co-office-share-merged-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-co-office-share-merged'],
  },
  emptyResult(0, 'list', 'brand_family'),
)
