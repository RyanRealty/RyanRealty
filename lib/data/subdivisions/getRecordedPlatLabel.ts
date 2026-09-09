/**
 * getRecordedPlatLabel — the county's own name for a recorded plat, read from
 * public.boundaries at an EXACT geo_slug (SITE-28, 2026-09-08).
 *
 * WHY. /communities/<city>-<name> derives its display name from the URL and
 * from MLS SubdivisionName, and MLS SubdivisionName is an ingest key, not a
 * place name. Verified live 2026-09-08: /communities/prineville-oll titled
 * itself "Oll Homes for Sale | Prineville, OR" with the H1 "Oll homes for
 * sale"; madras-parkpl published "ParkPL"; prineville-pleasvh published
 * "PleasVH". Publishing an MLS abbreviation as an Oregon place name under a
 * licensed broker's name is a §0 defect. The county recorded-plat set is the
 * one place a real name can honestly come from, so this reads it.
 *
 * EXACT, NEVER FUZZY. Membership by leading characters is FORBIDDEN
 * (MOBILE_GRIND C-21, restated in migration 20260826120000: the prefix rule
 * over-matched "Triple" to triple-ridge-* and cannot see an MLS abbreviation at
 * all). This function does one thing — geo_slug = <slug> — and answers null for
 * everything else. Nothing here infers, expands, or guesses a name.
 *
 * AND GEOMETRY IS NOT A NAME. The tempting alternative — take the compound
 * page's own in-boundary listings and title the page with the plat holding most
 * of their points — was measured and refuted 2026-09-08 (all row reads, all
 * `-- audit:`):
 *
 *   aspenb   -> 3 plats  (Aspen Heights Phase IV / Phase 2 / Phase III)
 *   stoneth  -> 2 plats  (Meadow Village, Stoneridge Townhomes At Sunriver)
 *   bbr      -> 5 plats  (five Black Butte Ranch homesite sections)
 *   drrhtrs  -> 17 plats
 *   clab     -> 28 unrelated plats (it is an MLS AREA code, not a subdivision)
 *
 * A majority vote over those publishes one arbitrary phase, or an unrelated
 * plat, as the page's place name. That is inventing a name, which is what §0
 * forbids, and the same conclusion the repo already reached: the plat-coverage
 * function's own comment says its output "is EVIDENCE, NOT A DECISION ... never
 * a request-time read, and never an automatic mapping". Reviewed evidence lives
 * in data/subdivision-alias-plats.json and is read from there.
 *
 * ABSENCE, BOTH SHAPES (§0). Broad first: public.boundaries holds 3,213
 * geo_type='subdivision' rows and every one is sourced "Deschutes County GIS
 * Subdivisions" — a bbox row read over lat 44.20-44.75 / lon -121.30 to -120.70
 * returned, for Madras and Prineville, only their TIGER city polygons and one
 * school district, and no plat at all. Then exact: geo_slug in
 * ('oll','parkpl','pleasvh',...) returned zero rows, and every geocoded PleasVH
 * listing point (35+) falls inside no recorded plat. That is not a query
 * artifact — data/subdivision-alias-plats.json already records the same fact in
 * its own words for two Prineville aliases: "Prineville = Crook County;
 * boundaries carries Deschutes plats only." So those three pages have no real
 * name available and must refuse rather than publish the abbreviation.
 *
 * SERVICE client: public.boundaries RLS hides subdivision rows from anon
 * (same as getSubdivisionBoundarySlugs / getPlatBoundaryCity). The output is a
 * public plat name.
 *
 * Read cost: one indexed single-row read per slug, cached for the plat-polygon
 * window (county plats effectively never move). Fallback null so a transient
 * failure reads as "unknown" — and unknown refuses, never publishes a guess.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

type BoundaryRow = { geo_label?: string | null }

/** Pure lookup over a row reader, so the test can drive it without a client. */
export async function readRecordedPlatLabel(
  slug: string,
  readPlat: (geoSlug: string) => Promise<BoundaryRow | null>,
): Promise<string | null> {
  const key = slug.trim().toLowerCase()
  if (!key) return null
  const row = await readPlat(key)
  const label = row?.geo_label?.trim()
  return label ? label : null
}

async function fetchRecordedPlatLabel(slug: string): Promise<string | null> {
  const supabase = createServiceClient()
  return readRecordedPlatLabel(slug, async (geoSlug) => {
    const { data, error } = await supabase
      .from('boundaries')
      .select('geo_label')
      .eq('geo_type', 'subdivision')
      .eq('geo_slug', geoSlug)
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`getRecordedPlatLabel: ${error.message}`)
    return (data as BoundaryRow | null) ?? null
  })
}

/** Cached per plat slug (unstable_cache keys on the argument). */
export const getRecordedPlatLabel = makeResilientCached(
  fetchRecordedPlatLabel,
  ['recorded-plat-label-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'boundaries'],
  },
  null,
)
