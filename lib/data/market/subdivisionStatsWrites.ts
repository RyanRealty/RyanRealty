/**
 * subdivisionStatsWrites — compute + cache per-subdivision market stats for the
 * curated resort-community registry (W2.1/W2.4 producer leg).
 *
 * PRODUCER→CONSUMER contract:
 *   - producer: public.compute_subdivision_period_stats (city+SubdivisionName
 *     scoped, canonical SFR methodology, ODS-gated median) writes market_stats_cache
 *     rows with geo_type='subdivision', geo_slug = slugify(alias).
 *   - consumer: /subdivisions/[slug] reads getMarketStats({geoType:'subdivision',
 *     geoSlug: slug, periodType:'ytd'}), where slug === slugify(alias). Write-key
 *     equals read-key by construction.
 *
 * §0: the alias→(City, SubdivisionName) mapping comes from data/resort-communities.json
 * (curated, verified: 54 aliases carry >=10 lifetime SFR sales with an exact
 * City+SubdivisionName match). period_type='ytd' anchored to Jan 1 is stable
 * (one row per geo per year, overwritten on refresh — no daily accumulation).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { slugify } from '@/lib/slug'
import resortCommunities from '@/data/resort-communities.json'

type Community = { city: string; subdivision_aliases?: string[] }

export interface SubdivisionStatResult {
  slug: string
  city: string
  subdivision: string
  ok: boolean
  soldCount?: number
  medianSalePrice?: number | null
  reason?: string
}

/** Jan 1 of the current UTC year, as YYYY-MM-01, for the stable ytd anchor. */
function ytdPeriodStart(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-01-01`
}

/**
 * Compute + cache ytd stats for every registry subdivision alias. Idempotent
 * (the RPC upserts on geo_type,geo_slug,period_type,period_start). Never throws;
 * returns a per-alias result. Runs from the refresh-subdivision-stats cron.
 */
export async function refreshSubdivisionStats(input?: {
  periodStart?: string
}): Promise<{ ok: number; skipped: number; results: SubdivisionStatResult[] }> {
  const periodStart = input?.periodStart ?? ytdPeriodStart()
  const communities = (resortCommunities as { communities?: Community[] }).communities ?? []
  const service = createServiceClient()

  const results: SubdivisionStatResult[] = []
  for (const community of communities) {
    const city = community.city
    for (const alias of community.subdivision_aliases ?? []) {
      const slug = slugify(alias)
      try {
        const { data, error } = await service.rpc('compute_subdivision_period_stats', {
          p_geo_slug: slug,
          p_city: city,
          p_subdivision_name: alias,
          p_period_type: 'ytd',
          p_period_start: periodStart,
        })
        if (error) {
          results.push({ slug, city, subdivision: alias, ok: false, reason: error.message })
          continue
        }
        const r = (data ?? {}) as { sold_count?: number; median_sale_price?: number | null }
        results.push({
          slug,
          city,
          subdivision: alias,
          ok: true,
          soldCount: Number(r.sold_count ?? 0),
          medianSalePrice: r.median_sale_price ?? null,
        })
      } catch (err) {
        results.push({ slug, city, subdivision: alias, ok: false, reason: err instanceof Error ? err.message : 'rpc failed' })
      }
    }
  }
  return {
    ok: results.filter((r) => r.ok).length,
    skipped: results.filter((r) => !r.ok).length,
    results,
  }
}
