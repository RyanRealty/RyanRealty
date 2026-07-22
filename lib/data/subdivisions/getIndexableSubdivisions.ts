/**
 * getIndexableSubdivisions — the live indexable-subdivision set feeding the
 * sitemap, llms.txt, and the /subdivisions/[slug] noindex decision.
 *
 * Sources (both already deployed — no new migration required for this read):
 *   1. public.boundaries geo_type='subdivision' (3,213 Deschutes County GIS
 *      plat polygons) — paginated via fetchAllRows (PostgREST 1,000-row cap).
 *   2. get_subdivision_status_counts(p_city) RPC per Central Oregon city —
 *      the same server-side aggregate app/sitemap.ts already uses for the
 *      /homes-for-sale browse-pair floor (Bend ~3.5s, others <1s; batched 6
 *      at a time, identical to the sitemap loop).
 *
 * The intersection + threshold logic is pure and lives in
 * lib/data/subdivisions/subdivision-index.ts (vitest-pinned). Cached 6h via
 * makeResilientCached: the fetch THROWS on any transient error so a blip is
 * never cached as "zero indexable subdivisions" (which would noindex 3,213
 * pages and empty the sitemap section for the whole TTL) — one uncached retry,
 * then the [] fallback for that single render only.
 *
 * Query shape (verification trace, §0): counts are server-side GROUP BY
 * TRIM("SubdivisionName") over public.listings filtered TRIM("City") ILIKE
 * city, closed = COUNT(*) FILTER (StandardStatus ILIKE '%closed%') — see
 * migration 20260323120000_pending_undercontract_contingent.sql. No raw
 * listings aggregation happens at request time in this module.
 */

import { createServiceClient } from '@/lib/data/client'
import { fetchAllRows } from '@/lib/supabase/paginate'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import {
  buildIndexableSubdivisions,
  type CitySubdivisionCounts,
  type IndexableSubdivision,
  type SubdivisionStatusCountRow,
} from '@/lib/data/subdivisions/subdivision-index'

const RPC_BATCH = 6

async function fetchIndexableSubdivisions(): Promise<IndexableSubdivision[]> {
  // SERVICE client, not anon, verified 2026-07-22: (a) public.boundaries RLS
  // hides subdivision rows from anon (anon read = 0 rows, service = 3,213),
  // and (b) the anon role's 3s statement_timeout kills the counts RPC for
  // every city (~3.1s even for Sisters). All three consumers (sitemap,
  // llms.txt, generateMetadata robots) are server-only, and the output is
  // non-sensitive (plat slugs + aggregate counts).
  const supabase = createServiceClient()

  // 1. Every plat slug with an authoritative polygon.
  const boundaryRows = await fetchAllRows<{ geo_slug?: string | null }>(
    supabase,
    'boundaries',
    'geo_slug',
    (q) => q.eq('geo_type', 'subdivision'),
  )
  const boundarySlugs = new Set(
    boundaryRows.map((r) => (r.geo_slug ?? '').trim()).filter((s) => s.length > 0),
  )
  if (boundarySlugs.size === 0) {
    // 3,213 plats exist in production — an empty read here is a failed read,
    // not a genuine empty. Throw so makeResilientCached never caches it.
    throw new Error('getIndexableSubdivisions: boundaries returned 0 subdivision slugs')
  }

  // 2. Per-city status counts from the deployed RPC, batched like the sitemap.
  const citySlugs = [...CENTRAL_OREGON_CITY_SLUGS]
  const cityCounts: CitySubdivisionCounts[] = []
  for (let i = 0; i < citySlugs.length; i += RPC_BATCH) {
    const batch = citySlugs.slice(i, i + RPC_BATCH)
    const results = await Promise.all(
      batch.map(async (citySlug) => {
        // Hyphenless allowlist slugs map back to the MLS spelling by swapping
        // hyphens for spaces ("la-pine" -> "la pine" ILIKE-matches "La Pine").
        const { data, error } = await supabase.rpc('get_subdivision_status_counts', {
          p_city: citySlug.replace(/-/g, ' '),
        })
        if (error) {
          // THROW (do not return []) — a transient RPC failure must not be
          // cached as "this city has zero subdivisions" for 6 hours.
          throw new Error(
            `getIndexableSubdivisions: get_subdivision_status_counts failed for ${citySlug}: ${error.message}`,
          )
        }
        return {
          citySlug,
          rows: (Array.isArray(data) ? data : []) as SubdivisionStatusCountRow[],
        }
      }),
    )
    cityCounts.push(...results)
  }

  return buildIndexableSubdivisions(boundarySlugs, cityCounts)
}

/**
 * The cached indexable set. 6h TTL (CACHE_WINDOWS.marketStats) — the inputs
 * (closed-sale counts) only move on closings, and the sitemap itself
 * regenerates hourly, so 6h staleness is invisible.
 */
export const getIndexableSubdivisions = makeResilientCached(
  fetchIndexableSubdivisions,
  ['indexable-subdivisions-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'boundaries'],
  },
  [],
)

/**
 * Page-side membership check for the /subdivisions/[slug] noindex decision.
 * Below-threshold (or polygon-less) slugs still render — they just carry
 * noindex via pageMetadata.
 */
export async function isSubdivisionIndexable(slug: string): Promise<boolean> {
  const set = await getIndexableSubdivisions()
  return set.some((s) => s.slug === slug)
}
