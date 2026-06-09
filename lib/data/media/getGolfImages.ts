/**
 * getGolfImages — approved Central Oregon golf photography from
 * `asset_library`, surface-tagged 'golf'. Powers the immersive golf landing
 * page hero + section imagery. Kept SEPARATE from the generic scenic
 * hero/card pools (getSurfaceImages) and the activity-lifestyle pool
 * (getLifestyleImages) so a golf-specific shot lands on the golf surface.
 *
 * Resolution order: photos whose `surface_tags` contain 'golf' come first
 * (these are curator-chosen for hero/section use). If that returns a thin
 * pool, photos whose `subject_tags` contain 'golf' backfill it (vision-tagged
 * subject, not yet promoted to a surface). Dedupe by url so a photo carrying
 * both tags appears once.
 *
 * Mirrors getLifestyleImages.ts: supabaseAnon, graceful null/error degrade,
 * a single mapping pass. Pair with pickGolfImage() to pick a deterministic
 * hero/section image by a stable seed (e.g. a city slug or section id).
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type GolfImage = { url: string; subjectTags: string[] }

type GolfRow = { file_url: string; subject_tags: string[] | null }

async function _getGolfImagesUncached(limit = 24): Promise<GolfImage[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  // Primary pool: curator-promoted golf surface photos.
  const { data: surfaceData, error: surfaceError } = await sb
    .from('asset_library')
    .select('file_url, subject_tags')
    .eq('type', 'photo')
    .eq('approval', 'approved')
    .contains('surface_tags', ['golf'])
    .not('file_url', 'is', null)
    .limit(120)
  // THROW on a transient DB error on the PRIMARY (hero-driving) read so
  // makeResilientCached never caches an empty golf pool (poison-null: one
  // asset_library/pooler blip would otherwise pin the golf LP hero + section
  // imagery to the fallback for the whole 1d assets window). A genuine empty
  // primary pool is fine — the subject-tag backfill below still runs.
  if (surfaceError) throw new Error(`[getGolfImages] surface_tags ${surfaceError.message ?? JSON.stringify(surfaceError)}`)

  const surfaceRows = (surfaceData ?? []) as GolfRow[]

  const seen = new Set<string>()
  const out: GolfImage[] = []
  for (const r of surfaceRows) {
    if (seen.has(r.file_url)) continue
    seen.add(r.file_url)
    out.push({ url: r.file_url, subjectTags: r.subject_tags ?? [] })
  }

  // Backfill from subject_tags when the surface pool is thin.
  if (out.length < limit) {
    const { data: subjectData, error: subjectError } = await sb
      .from('asset_library')
      .select('file_url, subject_tags')
      .eq('type', 'photo')
      .eq('approval', 'approved')
      .contains('subject_tags', ['golf'])
      .not('file_url', 'is', null)
      .limit(120)
    if (subjectError) console.error('[getGolfImages] subject_tags', subjectError)
    for (const r of (subjectData ?? []) as GolfRow[]) {
      if (seen.has(r.file_url)) continue
      seen.add(r.file_url)
      out.push({ url: r.file_url, subjectTags: r.subject_tags ?? [] })
    }
  }

  return out.slice(0, limit)
}

export const getGolfImages = makeResilientCached(
  _getGolfImagesUncached,
  // v2 — bumped alongside the poison-null fix (was unstable_cache, which cached []
  // on a transient error on the primary read). v1 entries may be poisoned; v2 evicts
  // them. The `limit` arg is part of the cache key automatically.
  ['golf-images-v2'],
  { revalidate: CACHE_WINDOWS.assets, tags: [cacheTag.assets] },
  [],
)

// Stable string hash (djb2) for deterministic, varied picks across surfaces.
// Same algorithm as pickSurfaceImage so behavior is consistent across the DAL.
function hashSeed(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0
  return h
}

/**
 * Deterministically pick ONE golf image from the pool by a stable seed.
 *
 * The same seed always returns the same image (so a hero is stable per route),
 * while different seeds spread across the pool (so a hero and a section image
 * on the same page differ). Returns `fallback` (or null) when the pool is empty.
 */
export function pickGolfImage(
  pool: GolfImage[],
  seed: string,
  fallback: string | null = null,
): string | null {
  if (!pool.length) return fallback
  const idx = hashSeed(seed) % pool.length
  return pool[idx]?.url ?? fallback
}
