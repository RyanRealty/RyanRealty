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

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

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
  // THROW on a transient DB error so makeResilientCached never caches the empty
  // map (poison-null: one pooler/timeout blip would otherwise blank every city /
  // neighborhood area tile site-wide for the whole 1d assets window). Genuine empty → {}.
  if (error) throw new Error(`[getGeoTileImages] ${error.message ?? JSON.stringify(error)}`)
  if (!data) return {}

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

export const getGeoTileImages = makeResilientCached(
  _getGeoTileImagesUncached,
  // v6 — bumped alongside the poison-null fix (was unstable_cache, which cached {}
  // on a transient error). v5 entries may be poisoned; v6 evicts them. The geoTags
  // arg is part of the cache key automatically.
  // History: v3 (2026-06-02) after a curation pass approved ~490 geo-tagged photos
  // via SQL with no updateTag; v2 after the asset_library anon-read RLS policy.
  ['geo-tile-images-v6'],
  { revalidate: CACHE_WINDOWS.assets, tags: [cacheTag.assets] },
  {},
)
