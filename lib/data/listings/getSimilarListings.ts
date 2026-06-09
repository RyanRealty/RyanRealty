/**
 * getSimilarListings — fetch the precomputed nearest 12 listings for an
 * active anchor listing.
 *
 * Reads from `public.similar_listings_mv` (Wave 1.6, migration
 * `20260527180000_similar_listings_mv.sql`). The MV precomputes the
 * (anchor → similar) mapping with same-city, ±20% price, ±1 bed
 * matching, ranked by same-subdivision-first, then closest-price, then
 * newest-modified.
 *
 * Hot path is sub-1ms via the unique index on (anchor_key, rank). The
 * subsequent IN-clause to listing_tile_mv to hydrate full tile data is
 * 2-3ms per call.
 *
 * If the anchor isn't in the MV (e.g. it's a closed listing — only
 * active-set listings get precomputed similars), returns an empty
 * array. Callers should treat that as "no similar rail" — same as if
 * the anchor has 0 matching similars.
 *
 * Per docs/DATA_ACCESS_LAYER.md — every page that needs similar
 * listings calls this function. The legacy in-page resolvers
 * (getSimilarListingsForDetailPage / getSimilarListingsByKeyOnly in
 * app/actions/listing-detail.ts) remain in place for now; they'll
 * migrate to this DAL function in a follow-up commit.
 */

import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import type { ListingTile } from '@/lib/data/types/listing'
import { getListingTiles } from './getListingTiles'
import { resolveCanonicalListingKey } from '@/lib/data/listings/resolveCanonicalListingKey'

const InputSchema = z.object({
  anchorKey: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(12).default(12),
})

type SimilarRow = {
  similar_key: string
  rank: number
  similarity_score: number
}

async function fetchSimilarKeys(
  anchorKey: string,
  limit: number,
): Promise<string[]> {
  const canonicalKey = await resolveCanonicalListingKey(anchorKey)
  const sb = supabaseAnon()
  if (!sb) return []
  const { data, error } = await sb
    .from('similar_listings_mv')
    .select('similar_key, rank, similarity_score')
    .eq('anchor_key', canonicalKey)
    .order('rank', { ascending: true })
    .limit(limit)
  // THROW on a transient DB error so the resilient cache wrapping fetchSimilarTiles
  // never caches an empty "similar homes" rail (poison-null: this fetch is called
  // INSIDE the cached body, so one similar_listings_mv blip would otherwise blank
  // the rail on a listing-detail page for the whole window). Genuine empty → [].
  if (error) throw new Error(`[getSimilarListings] keys lookup ${anchorKey}/${canonicalKey}: ${error.message ?? JSON.stringify(error)}`)
  return ((data ?? []) as SimilarRow[]).map((r) => r.similar_key)
}

async function fetchSimilarTiles(
  anchorKey: string,
  limit: number,
): Promise<ListingTile[]> {
  const keys = await fetchSimilarKeys(anchorKey, limit)
  if (keys.length === 0) return []
  // Hydrate full tile data for each similar. Preserves the rank order
  // returned from the MV by reading tiles into a map keyed by listing_key.
  const tiles = await getListingTiles({
    listingKeys: keys,
    status: 'all',
    limit: keys.length,
  })
  const byKey = new Map(tiles.map((t) => [t.listingKey, t]))
  // Filter+map in rank order; drop any anchors whose similars are no
  // longer in the tile MV (e.g. status changed since last refresh).
  return keys
    .map((k) => byKey.get(k))
    .filter((t): t is ListingTile => !!t)
}

// Resilient cache. v2 — bumped alongside the poison-null fix. fetchSimilarKeys
// (called inside fetchSimilarTiles) now THROWS on a DB error instead of returning
// []; makeResilientCached retries once uncached then falls back to [] without ever
// caching the empty rail. anchorKey + limit are part of the cache key automatically.
const cachedSimilarTiles = makeResilientCached(
  fetchSimilarTiles,
  ['similar-listings-v2'],
  { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
  [],
)

export const getSimilarListings = (
  anchorKey: string,
  limit: number = 12,
): Promise<ListingTile[]> => {
  InputSchema.parse({ anchorKey, limit })
  return cachedSimilarTiles(anchorKey, limit)
}
