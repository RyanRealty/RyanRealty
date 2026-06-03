/**
 * getGeoTileImages — representative imagery for geo tiles (city / neighborhood
 * area cards), pulled from the CANONICAL asset store: `public.asset_library`.
 *
 * WHY THIS IS THE SOURCE OF TRUTH (locked 2026-05-28 per Matt directive):
 *   The cities / neighborhoods / communities tables carry no usable hero
 *   images (cities + communities are empty; neighborhoods hold repeated
 *   generic Unsplash stock — the SAME photo on six different neighborhoods,
 *   which we will not ship). The real, curated, geo-tagged Central Oregon
 *   photography lives in `asset_library` (572 approved photos tagged
 *   bend / redmond / sisters / sunriver / prineville / tumalo / smith-rock /
 *   central-oregon). `file_url` is a public Supabase Storage URL already
 *   allowed by next.config `remotePatterns` (*.supabase.co/storage/.../public).
 *
 * Golf / master-planned community imagery is NOT here — those come from the
 * curated landing-page set in `lib/geo-images.ts` (GOLF_COMMUNITY_IMAGES).
 *
 * Returns a map of geo_tag -> array of image URLs. Callers pick one per tile
 * with `pickGeoImage()` (deterministic by slug) and fall back to the
 * 'central-oregon' tag when a specific place has no tagged photo.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type GeoTileImageMap = Record<string, string[]>

async function _getGeoTileImagesUncached(geoTags: string[]): Promise<GeoTileImageMap> {
  const sb = supabaseAnon()
  if (!sb || geoTags.length === 0) return {}

  // Always include the region fallback so callers can resolve places that
  // have no place-specific photo.
  const tags = [...new Set([...geoTags, 'central-oregon'])]

  const { data, error } = await sb
    .from('asset_library')
    .select('geo_tags, subject_tags, file_url')
    .eq('type', 'photo')
    .eq('approval', 'approved')
    .overlaps('geo_tags', tags)
    .not('file_url', 'is', null)
    .limit(600)
  if (error || !data) {
    if (error) console.error('[getGeoTileImages]', error)
    return {}
  }

  // Prefer scenic/exterior shots over interiors for an area tile.
  const isScenic = (subjects: string[] | null) =>
    !subjects ||
    subjects.some((s) => /landscape|exterior|aerial|mountain|river|lake|downtown|skyline|drone/i.test(s))

  const map: GeoTileImageMap = {}
  const fallbackInteriors: GeoTileImageMap = {}
  for (const row of data as Array<{ geo_tags: string[]; subject_tags: string[] | null; file_url: string }>) {
    const target = isScenic(row.subject_tags) ? map : fallbackInteriors
    for (const tag of row.geo_tags ?? []) {
      if (!tags.includes(tag)) continue
      ;(target[tag] ??= []).push(row.file_url)
    }
  }
  // Backfill any tag that had only interior shots.
  for (const tag of tags) {
    if (!map[tag]?.length && fallbackInteriors[tag]?.length) map[tag] = fallbackInteriors[tag]
  }
  return map
}

export const getGeoTileImages = unstable_cache(
  _getGeoTileImagesUncached,
  // v3 — bumped 2026-06-02 after the big curation pass approved ~490 new
  // geo-tagged photos via SQL (no updateTag fired), so the warm v2 entry would
  // otherwise serve the old small approved set for up to a day. v2 — bumped
  // after the asset_library anon-read RLS policy landed.
  ['geo-tile-images-v5'],
  { revalidate: CACHE_WINDOWS.assets, tags: [cacheTag.assets] },
)
