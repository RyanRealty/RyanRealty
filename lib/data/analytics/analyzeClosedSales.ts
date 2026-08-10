/**
 * Constrained closed-sales analyzer for unique multi-dim queries (CO only).
 *
 * H5 / G62 — zero request-path closed-sales row scans:
 *   1. analytics_result_cache (filter hash)
 *   2. analytics_mart_market_annual (region/city × year × type_scope)
 *   3. analyze_closed_sales_co RPC (SQL aggregate, metrics only — no listings fan-out)
 *   4. Persist RPC/mart results into result_cache
 *
 * Never pages `listings` from Node. No details JSONB.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

const RESULT_CACHE_TTL_HOURS = 24
const RESULT_CACHE_VERSION = 'v1'

const InputSchema = z.object({
  year: z.number().int().min(1998).max(2030),
  city: z.string().min(1).max(80).optional(),
  propertyType: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']).optional(),
  fireplace: z.boolean().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
})

export type AnalyzeClosedSalesInput = z.input<typeof InputSchema>

export type AnalyzeClosedSalesResult = {
  soldCount: number
  totalVolume: number
  medianClose: number | null
  meanClose: number | null
  filters: AnalyzeClosedSalesInput
  methodology: string
  computedAt: string
  /** Where metrics came from (for ops / empty states). */
  source: 'result_cache' | 'mart' | 'rpc' | 'empty'
}

type Normalized = {
  year: number
  city?: string
  propertyType?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'
  fireplace?: boolean
  minPrice?: number
  maxPrice?: number
}

function emptyResult(
  f: Normalized,
  source: AnalyzeClosedSalesResult['source'] = 'empty',
): AnalyzeClosedSalesResult {
  return {
    soldCount: 0,
    totalVolume: 0,
    medianClose: null,
    meanClose: null,
    filters: f,
    methodology: ANALYTICS_METHODOLOGY_V1,
    computedAt: new Date().toISOString(),
    source,
  }
}

/** Canonical city proper or undefined if not in service area. */
function resolveCity(city: string | undefined): string | undefined {
  if (!city?.trim()) return undefined
  const hit = ANALYTICS_CO_CITIES_PROPER.find(
    (c) => c.toLowerCase() === city.trim().toLowerCase(),
  )
  return hit
}

function cityToGeoSlug(cityProper: string): string {
  return cityProper.trim().toLowerCase().replace(/\s+/g, '-')
}

/**
 * Mart type_scope mapping — only exact mappings (no B/C→multi collapse).
 * Returns null when mart cannot answer exactly (caller uses RPC).
 */
function typeScopeForMart(
  propertyType: Normalized['propertyType'],
): 'all' | 'sfr' | 'land' | null {
  if (!propertyType) return 'all'
  if (propertyType === 'A') return 'sfr'
  if (propertyType === 'D') return 'land'
  return null
}

function normalize(input: AnalyzeClosedSalesInput): Normalized {
  const f = InputSchema.parse(input)
  const city = resolveCity(f.city)
  let minPrice = f.minPrice != null && Number.isFinite(f.minPrice) ? f.minPrice : undefined
  let maxPrice = f.maxPrice != null && Number.isFinite(f.maxPrice) ? f.maxPrice : undefined
  if (minPrice != null) minPrice = Math.max(0, minPrice)
  if (maxPrice != null && minPrice != null && maxPrice < minPrice) {
    const t = minPrice
    minPrice = maxPrice
    maxPrice = t
  }
  // Drop redundant min that is just the closed CTE floor
  if (minPrice != null && minPrice <= 1000) minPrice = undefined

  return {
    year: f.year,
    city,
    propertyType: f.propertyType,
    fireplace: f.fireplace === true ? true : undefined,
    minPrice,
    maxPrice,
  }
}

function filterHash(f: Normalized): string {
  const payload = {
    v: RESULT_CACHE_VERSION,
    year: f.year,
    city: f.city ?? null,
    propertyType: f.propertyType ?? null,
    fireplace: f.fireplace === true,
    minPrice: f.minPrice ?? null,
    maxPrice: f.maxPrice ?? null,
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 40)
}

function getClient() {
  try {
    return createServiceClient()
  } catch {
    return supabaseAnon()
  }
}

async function readResultCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  hash: string,
  f: Normalized,
): Promise<AnalyzeClosedSalesResult | null> {
  const { data, error } = await sb
    .from('analytics_result_cache')
    .select('sold_count,total_volume,median_close,mean_close,methodology,computed_at,expires_at')
    .eq('filter_hash', hash)
    .maybeSingle()
  if (error || !data) return null
  const exp = data.expires_at ? new Date(data.expires_at as string).getTime() : 0
  if (exp && exp < Date.now()) return null
  return {
    soldCount: Number(data.sold_count) || 0,
    totalVolume: Number(data.total_volume) || 0,
    medianClose: data.median_close != null ? Number(data.median_close) : null,
    meanClose: data.mean_close != null ? Number(data.mean_close) : null,
    filters: f,
    methodology: (data.methodology as string) || ANALYTICS_METHODOLOGY_V1,
    computedAt: (data.computed_at as string) || new Date().toISOString(),
    source: 'result_cache',
  }
}

async function writeResultCache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  hash: string,
  f: Normalized,
  result: AnalyzeClosedSalesResult,
  source: 'mart' | 'rpc',
): Promise<void> {
  const expires = new Date(Date.now() + RESULT_CACHE_TTL_HOURS * 3600 * 1000).toISOString()
  const row = {
    filter_hash: hash,
    filters: {
      year: f.year,
      city: f.city ?? null,
      propertyType: f.propertyType ?? null,
      fireplace: f.fireplace === true,
      minPrice: f.minPrice ?? null,
      maxPrice: f.maxPrice ?? null,
    },
    sold_count: result.soldCount,
    total_volume: result.totalVolume,
    median_close: result.medianClose,
    mean_close: result.meanClose,
    methodology: result.methodology,
    source,
    computed_at: result.computedAt,
    expires_at: expires,
  }
  const { error } = await sb.from('analytics_result_cache').upsert(row, { onConflict: 'filter_hash' })
  if (error) {
    console.warn('[analyzeClosedSales] result_cache upsert failed:', error.message)
  }
}

/**
 * Mart-compatible when no price band, no fireplace, and type maps to type_scope.
 */
async function readMart(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  f: Normalized,
): Promise<AnalyzeClosedSalesResult | null> {
  if (f.fireplace || f.minPrice != null || f.maxPrice != null) return null
  const typeScope = typeScopeForMart(f.propertyType)
  if (!typeScope) return null

  const geo_type = f.city ? 'city' : 'region'
  const geo_slug = f.city ? cityToGeoSlug(f.city) : 'central-oregon'

  const { data, error } = await sb
    .from('analytics_mart_market_annual')
    .select('sold_count,total_volume,median_close,mean_close,methodology,computed_at')
    .eq('geo_type', geo_type)
    .eq('geo_slug', geo_slug)
    .eq('year', f.year)
    .eq('type_scope', typeScope)
    .maybeSingle()

  if (error || !data) return null
  return {
    soldCount: Number(data.sold_count) || 0,
    totalVolume: Number(data.total_volume) || 0,
    medianClose: data.median_close != null ? Number(data.median_close) : null,
    meanClose: data.mean_close != null ? Number(data.mean_close) : null,
    filters: f,
    methodology: (data.methodology as string) || ANALYTICS_METHODOLOGY_V1,
    computedAt: (data.computed_at as string) || new Date().toISOString(),
    source: 'mart',
  }
}

async function callRpc(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  f: Normalized,
): Promise<AnalyzeClosedSalesResult | null> {
  const { data, error } = await sb.rpc('analyze_closed_sales_co', {
    p_year: f.year,
    p_city: f.city ?? null,
    p_property_type: f.propertyType ?? null,
    p_fireplace: f.fireplace === true ? true : null,
    p_min_price: f.minPrice ?? null,
    p_max_price: f.maxPrice ?? null,
  })
  if (error) throw new Error(`[analyzeClosedSales rpc] ${error.message}`)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return emptyResult(f, 'rpc')
  return {
    soldCount: Number(row.sold_count) || 0,
    totalVolume: Number(row.total_volume) || 0,
    medianClose: row.median_close != null ? Number(row.median_close) : null,
    meanClose: row.mean_close != null ? Number(row.mean_close) : null,
    filters: f,
    methodology: ANALYTICS_METHODOLOGY_V1,
    computedAt: new Date().toISOString(),
    source: 'rpc',
  }
}

async function fetchAnalyze(input: AnalyzeClosedSalesInput): Promise<AnalyzeClosedSalesResult> {
  const f = normalize(input)
  // Invalid city string that didn't resolve → empty (not all-CO)
  if (input.city?.trim() && !f.city) return emptyResult(f)

  const sb = getClient()
  if (!sb) return emptyResult(f)

  const hash = filterHash(f)

  // 1) Result cache
  const cached = await readResultCache(sb, hash, f)
  if (cached) return cached

  // 2) Precomputed mart (region or city × year × type_scope)
  const mart = await readMart(sb, f)
  if (mart) {
    await writeResultCache(sb, hash, f, mart, 'mart')
    return mart
  }

  // 3) SQL aggregate RPC only — never page listings in Node
  const rpc = await callRpc(sb, f)
  if (rpc) {
    await writeResultCache(sb, hash, f, rpc, 'rpc')
    return rpc
  }

  return emptyResult(f)
}

export const analyzeClosedSales = makeResilientCached(
  fetchAnalyze,
  ['analytics-analyze-closed-v2'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'analytics-analyze-closed'],
  },
  {
    soldCount: 0,
    totalVolume: 0,
    medianClose: null,
    meanClose: null,
    filters: { year: 2024 },
    methodology: ANALYTICS_METHODOLOGY_V1,
    computedAt: new Date().toISOString(),
    source: 'empty' as const,
  },
)
