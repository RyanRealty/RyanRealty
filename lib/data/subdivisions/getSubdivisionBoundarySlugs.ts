/**
 * getSubdivisionBoundarySlugs — the full set of plat slugs holding an
 * authoritative GIS polygon in public.boundaries (geo_type='subdivision',
 * 3,213 Deschutes County plats as of 2026-09-01).
 *
 * This is the BOUNDARY-ONLY set: strictly larger than
 * getIndexableSubdivisions(), which additionally requires
 * SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime closed sales before a plat
 * earns index,follow. A plat with a polygon but few sales still RENDERS at
 * /subdivisions/[slug] (noindex) — so any caller deciding "will this plat
 * page render?" must use THIS set, never the indexable one. Founding case:
 * neighborhood subdivision cards advertised plats whose pages then served
 * the SubdivisionUnavailable refusal (Pettigrew Place, 2026-09-01).
 *
 * SERVICE client, not anon (same as getIndexableSubdivisions, verified
 * 2026-07-22): public.boundaries RLS hides subdivision rows from anon. The
 * output is non-sensitive (plat slugs only).
 */

import { fetchAllRows } from '@/lib/supabase/paginate'
import { createServiceClient } from '@/lib/supabase/service'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

async function fetchSubdivisionBoundarySlugs(): Promise<string[]> {
  const supabase = createServiceClient()
  const rows = await fetchAllRows<{ geo_slug?: string | null }>(
    supabase,
    'boundaries',
    'geo_slug',
    (q) => q.eq('geo_type', 'subdivision'),
  )
  const slugs = [...new Set(rows.map((r) => (r.geo_slug ?? '').trim()).filter((s) => s.length > 0))]
  if (slugs.length === 0) {
    // 3,213 plats exist in production — an empty read is a failed read, not a
    // genuine empty. Throw so makeResilientCached never caches it.
    throw new Error('getSubdivisionBoundarySlugs: boundaries returned 0 subdivision slugs')
  }
  return slugs
}

/** Cached boundary-slug set. 6h TTL — county plat polygons effectively never move. */
export const getSubdivisionBoundarySlugs = makeResilientCached(
  fetchSubdivisionBoundarySlugs,
  ['subdivision-boundary-slugs-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'boundaries'],
  },
  // Fallback empty: callers treat a failed read as "unknown", never as "no
  // plats" — the consumer guards with withTimeoutFallbackResult and keeps
  // every card when the read did not answer.
  [],
)
