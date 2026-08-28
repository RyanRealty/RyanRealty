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
 * never returned here. Curators set `surface_tags` (hero/card) via /admin/media/photos;
 * `getGeoTileImages` covers untagged area tiles, this covers banner/hero slots.
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type SurfaceImage = { url: string; geoTags: string[]; subjectTags: string[] }
export type Surface = 'hero' | 'card'

type AssetRow = { file_url: string; geo_tags: string[] | null; subject_tags: string[] | null }

function toSurfaceImages(rows: AssetRow[] | null): SurfaceImage[] {
  if (!rows) return []
  return rows.map((r) => ({
    url: r.file_url,
    geoTags: r.geo_tags ?? [],
    subjectTags: r.subject_tags ?? [],
  }))
}

function mergeSurfaceImages(...pools: SurfaceImage[][]): SurfaceImage[] {
  const seen = new Set<string>()
  const out: SurfaceImage[] = []
  for (const pool of pools) {
    for (const image of pool) {
      if (!image.url || seen.has(image.url)) continue
      seen.add(image.url)
      out.push(image)
    }
  }
  return out
}

async function _getSurfaceImagesUncached(surface: Surface): Promise<SurfaceImage[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  // Machine-vision quality gate (2026-06-10): hero/card slots serve A/B-grade
  // photography. Approved Grok Imagine place stills are the one exception —
  // they ship with vision_grade null because Matt directed them into
  // asset_library as owned place heroes (2026-08-22). C-grade and other
  // ungraded assets still never reach a page surface.
  const graded = sb
    .from('asset_library')
    .select('file_url, geo_tags, subject_tags')
    .eq('type', 'photo')
    .eq('approval', 'approved')
    .in('vision_grade', ['A', 'B'])
    .contains('surface_tags', [surface])
    .not('file_url', 'is', null)
    .limit(600)
  const grokImagine = sb
    .from('asset_library')
    .select('file_url, geo_tags, subject_tags')
    .eq('type', 'photo')
    .eq('approval', 'approved')
    .eq('source', 'grok-imagine')
    .is('vision_grade', null)
    .contains('surface_tags', [surface])
    .not('file_url', 'is', null)
    .limit(200)
  const [gradedRes, grokRes] = await Promise.all([graded, grokImagine])
  // THROW on a transient DB error so makeResilientCached never caches the empty
  // result (poison-null: one pooler/timeout blip would otherwise blank every page
  // hero/card for the whole assets window). A genuine empty success returns [].
  if (gradedRes.error) {
    throw new Error(`[getSurfaceImages] ${gradedRes.error.message ?? JSON.stringify(gradedRes.error)}`)
  }
  if (grokRes.error) {
    throw new Error(`[getSurfaceImages] ${grokRes.error.message ?? JSON.stringify(grokRes.error)}`)
  }
  return mergeSurfaceImages(
    toSurfaceImages((gradedRes.data ?? []) as AssetRow[]),
    toSurfaceImages((grokRes.data ?? []) as AssetRow[]),
  )
}

export const getSurfaceImages = makeResilientCached(
  _getSurfaceImagesUncached,
  // v5 — include approved grok-imagine place stills that have no vision_grade.
  // v4 evicted poison-null []; those entries are stale for place Stage.
  ['surface-images-v5'],
  { revalidate: CACHE_WINDOWS.assets, tags: [cacheTag.assets] },
  [],
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
const REGIONAL_GEO = new Set(['central-oregon'])

function placeSpecificity(geoTags: string[], wanted: Set<string>): number {
  const places = geoTags.map((g) => g.toLowerCase()).filter((g) => !REGIONAL_GEO.has(g))
  if (!places.some((g) => wanted.has(g))) return 0
  // Exact place: the requested slug is the only non-regional tag, so a city
  // Stage cannot inherit a neighborhood still that also carries the city tag.
  if (places.length === 1 && wanted.has(places[0]!)) return 2
  return 1
}

export function pickSurfaceImage(
  pool: SurfaceImage[],
  opts: { geoTags?: string[]; seed: string; fallback?: string | null; geoOnly?: boolean },
): string | null {
  const { geoTags = [], seed, fallback = null, geoOnly = false } = opts
  if (!pool.length) return fallback

  const wanted = new Set(geoTags.map((g) => g.toLowerCase()))
  const matches = wanted.size ? pool.filter((p) => p.geoTags.some((g) => wanted.has(g.toLowerCase()))) : []
  if (geoOnly) {
    if (!matches.length) return fallback
    const exact = matches.filter((p) => placeSpecificity(p.geoTags, wanted) === 2)
    const bucket = exact.length ? exact : matches
    const idx = hashSeed(seed) % bucket.length
    return bucket[idx]?.url ?? fallback
  }
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
  opts: { geoTags?: string[]; seed: string; fallback?: string | null; geoOnly?: boolean },
): Promise<string | null> {
  const pool = await getSurfaceImages(surface)
  return pickSurfaceImage(pool, opts)
}
