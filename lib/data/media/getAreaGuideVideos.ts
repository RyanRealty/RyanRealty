/**
 * getAreaGuideVideo — the approved per-location AREA GUIDE video for a geo, from
 * the canonical asset store `public.asset_library`.
 *
 * Unlike getSurfaceImage (which falls back to a regional / any photo so hero+card
 * slots always fill), an area-guide video must be an EXACT geo match — a Bend
 * area guide playing on a Sisters page is wrong — so this returns null when the
 * location has no guide video. These are finished marketing cuts (voiceover +
 * on-screen text), so they belong in a click-to-play "Watch the area guide" slot,
 * never a silent looping hero.
 */
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type AreaGuideVideo = { url: string; geoTags: string[]; wide: boolean }

async function _getAreaGuideVideosUncached(): Promise<AreaGuideVideo[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data, error } = await sb
    .from('asset_library')
    .select('file_url, geo_tags, surface_tags')
    .eq('type', 'video')
    .eq('approval', 'approved')
    .contains('surface_tags', ['area-guide'])
    .not('file_url', 'is', null)
    .limit(600)
  // THROW on a transient DB error so makeResilientCached never caches an empty
  // result (poison-null). A genuine empty success returns [].
  if (error) throw new Error(`[getAreaGuideVideos] ${error.message ?? JSON.stringify(error)}`)
  if (!data) return []
  return (data as Array<{ file_url: string; geo_tags: string[] | null; surface_tags: string[] | null }>).map((r) => ({
    url: r.file_url,
    geoTags: r.geo_tags ?? [],
    wide: (r.surface_tags ?? []).includes('area-guide-wide'),
  }))
}

export const getAreaGuideVideos = makeResilientCached(
  _getAreaGuideVideosUncached,
  ['area-guide-videos-v1'],
  { revalidate: CACHE_WINDOWS.assets, tags: [cacheTag.assets] },
  [],
)

/**
 * The area-guide video URL for an EXACT geo slug (no regional fallback). Returns
 * null when the location has no approved guide video — the caller hides the slot.
 * Pass extra alias slugs (e.g. ['nw-crossing','northwest-crossing']) when a geo is
 * tagged inconsistently; the first exact match wins.
 */
export async function getAreaGuideVideo(geoSlugs: string | string[]): Promise<string | null> {
  const wanted = (Array.isArray(geoSlugs) ? geoSlugs : [geoSlugs])
    .filter(Boolean)
    .map((g) => g.toLowerCase())
  if (!wanted.length) return null
  const pool = await getAreaGuideVideos()
  const matches = pool.filter((v) => v.geoTags.some((g) => wanted.includes(g.toLowerCase())))
  if (!matches.length) return null
  // Prefer the landscape (16:9) cut; it fills the 16:9 player. A portrait 9:16
  // social only letterboxes (acceptable fallback when no wide cut exists).
  return (matches.find((m) => m.wide) ?? matches[0]).url
}
