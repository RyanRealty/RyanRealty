/**
 * Constrained closed-sales analyzer for unique multi-dim queries (CO only).
 * Live aggregate, cached. No details JSONB. G62-safe.
 */
import 'server-only'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { ANALYTICS_CO_CITIES_PROPER, ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

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
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const a = [...nums].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

async function fetchAnalyze(input: AnalyzeClosedSalesInput): Promise<AnalyzeClosedSalesResult> {
  const f = InputSchema.parse(input)
  let sb
  try {
    sb = createServiceClient()
  } catch {
    sb = supabaseAnon()
  }
  if (!sb) {
    return {
      soldCount: 0,
      totalVolume: 0,
      medianClose: null,
      meanClose: null,
      filters: f,
      methodology: ANALYTICS_METHODOLOGY_V1,
      computedAt: new Date().toISOString(),
    }
  }

  const cities = f.city
    ? ANALYTICS_CO_CITIES_PROPER.filter((c) => c.toLowerCase() === f.city!.toLowerCase())
    : [...ANALYTICS_CO_CITIES_PROPER]
  if (!cities.length) {
    return {
      soldCount: 0,
      totalVolume: 0,
      medianClose: null,
      meanClose: null,
      filters: f,
      methodology: ANALYTICS_METHODOLOGY_V1,
      computedAt: new Date().toISOString(),
    }
  }

  const prices: number[] = []
  let from = 0
  const page = 1000
  for (;;) {
    let q = sb
      .from('listings')
      .select('ClosePrice,fireplace_yn,PropertyType')
      .ilike('StandardStatus', '%Closed%')
      .gte('ClosePrice', 1000)
      .not('CloseDate', 'is', null)
      .in('City', cities)
      .gte('CloseDate', `${f.year}-01-01`)
      .lte('CloseDate', `${f.year}-12-31`)
      .order('ListingKey', { ascending: true })
      .range(from, from + page - 1)
    if (f.propertyType) q = q.eq('PropertyType', f.propertyType)
    if (f.fireplace === true) q = q.eq('fireplace_yn', true)
    if (f.minPrice != null) q = q.gte('ClosePrice', f.minPrice)
    if (f.maxPrice != null) q = q.lte('ClosePrice', f.maxPrice)

    const { data, error } = await q
    if (error) throw new Error(`[analyzeClosedSales] ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      const p = Number(row.ClosePrice)
      if (Number.isFinite(p)) prices.push(p)
    }
    if (data.length < page) break
    from += page
    if (from > 80000) break
  }

  const soldCount = prices.length
  const totalVolume = prices.reduce((a, b) => a + b, 0)
  return {
    soldCount,
    totalVolume,
    medianClose: median(prices),
    meanClose: soldCount ? totalVolume / soldCount : null,
    filters: f,
    methodology: ANALYTICS_METHODOLOGY_V1,
    computedAt: new Date().toISOString(),
  }
}

export const analyzeClosedSales = makeResilientCached(
  fetchAnalyze,
  ['analytics-analyze-closed-v1'],
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
  },
)
