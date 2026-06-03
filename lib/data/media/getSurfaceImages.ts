/**
 * getSurfaceImages — approved, surface-tagged photography for page heroes and
 * cards, from the canonical asset store `public.asset_library`.
 *
 * This is the resolver that fixes "every page uses the same hero." Instead of a
 * single hardcoded banner site-wide, each surface (a city page, /about, /sell,
 * a neighborhood) resolves a DISTINCT approved photo via `pickSurfaceImage`,
 * deterministically seeded by the page slug so it is stable per route but varies
 * across routes.
 *
 * The homepage keeps its canonical Old Mill master hero (a design-system file
 * served from /public, NOT in asset_library) — so it stays homepage-only and is
 * never returned here. Curators set `surface_tags` (hero/card) via /admin/photos;
 * `getGeoTileImages` covers untagged area tiles, this covers banner/hero slots.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type SurfaceImage = { url: string; geoTags: string[]; subjectTags: string[] }
export type Surface = 'hero' | 'card'

async function _getSurfaceImagesUncached(surface: Surface): Promise<SurfaceImage[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data, error } = await sb
    .from('asset_library')
    .select('file_url, geo_tags, subject_tags')
    .eq('type', 'photo')
    .eq('approval', 'approved')
    .contains('surface_tags', [surface])
    .not('file_url', 'is', null)
    .limit(600)
  if (error || !data) {
    if (error) console.error('[getSurfaceImages]', error)
    return []
  }
  return (data as Array<{ file_url: string; geo_tags: string[] | null; subject_tags: string[] | null }>).map((r) => ({
    url: r.file_url,
    geoTags: r.geo_tags ?? [],
    subjectTags: r.subject_tags ?? [],
  }))
}

export const getSurfaceImages = unstable_cache(
  _getSurfaceImagesUncached,
  ['surface-images-v1'],
  { revalidate: CACHE_WINDOWS.assets, tags: [cacheTag.assets] },
)

// Stable string hash (djb2) for deterministic, varied picks across routes.
function hashSeed(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0
  return h
}

/**
 * Deterministically pick ONE surface image for a page.
 *
 * Preference order: a photo tagged with one of `geoTags` → a 'central-oregon'
 * photo → any photo in the pool. Within the best-matching bucket the choice is
 * seeded by `seed` (e.g. the route slug) so the same page always renders the
 * same image, but different pages spread across the pool. Returns `fallback`
 * (or null) when the pool is empty.
 */
export function pickSurfaceImage(
  pool: SurfaceImage[],
  opts: { geoTags?: string[]; seed: string; fallback?: string | null },
): string | null {
  const { geoTags = [], seed, fallback = null } = opts
  if (!pool.length) return fallback

  const wanted = new Set(geoTags.map((g) => g.toLowerCase()))
  const matches = wanted.size ? pool.filter((p) => p.geoTags.some((g) => wanted.has(g.toLowerCase()))) : []
  const regional = pool.filter((p) => p.geoTags.some((g) => g.toLowerCase() === 'central-oregon'))

  const bucket = matches.length ? matches : regional.length ? regional : pool
  const idx = hashSeed(seed) % bucket.length
  return bucket[idx]?.url ?? fallback
}

/**
 * One-shot convenience: fetch the pool and pick. Use in a server component when
 * a page needs a single hero/card URL.
 */
export async function getSurfaceImage(
  surface: Surface,
  opts: { geoTags?: string[]; seed: string; fallback?: string | null },
): Promise<string | null> {
  const pool = await getSurfaceImages(surface)
  return pickSurfaceImage(pool, opts)
}
