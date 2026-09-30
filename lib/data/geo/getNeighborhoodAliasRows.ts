/**
 * getNeighborhoodAliasRows — every MLS SubdivisionName label a neighborhood
 * aggregates by name (public.neighborhood_subdivisions, about 1,700 rows).
 *
 * Two instruments read this table, and a reconciliation that rebuilds their
 * figures from Spark needs the same labels they used:
 *   - market_stats_cache (methodology v3-2026-05-07) builds a neighborhood's
 *     closed-sale population from these labels: "subdivisions whose centroid
 *     falls in the neighborhood polygon (public.neighborhood_subdivisions)".
 *   - Market Truth place_membership falls back to them for a listing that sits
 *     inside no neighborhood polygon, or has no coordinates (nbh_alias,
 *     supabase/migrations/20260923014500_place_membership_incremental_refresh.sql).
 *
 * Uncached on purpose: its caller is the market-report render script, which
 * reconciles each figure against Spark once per run. Throws on a read error so
 * a caller never mistakes a failed read for "no aliases".
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type NeighborhoodAliasRow = {
  neighborhoodSlug: string
  subdivisionLabel: string
}

export async function getNeighborhoodAliasRows(): Promise<NeighborhoodAliasRow[]> {
  const sb = createServiceClient()
  const { rows, error } = await fetchPagedRows<{ neighborhood_slug: string; subdivision_label: string }>(
    (from, to) =>
      sb
        .from('neighborhood_subdivisions')
        .select('neighborhood_slug, subdivision_label')
        .order('neighborhood_slug', { ascending: true })
        .order('subdivision_label', { ascending: true })
        .range(from, to),
  )
  if (error) throw new Error(`[getNeighborhoodAliasRows] ${error.message}`)
  return rows
    .filter((r) => typeof r.neighborhood_slug === 'string' && typeof r.subdivision_label === 'string')
    .map((r) => ({ neighborhoodSlug: r.neighborhood_slug, subdivisionLabel: r.subdivision_label }))
}
