/**
 * getListingPhotos — fetch the ordered photo array for a listing.
 *
 * Three-tier fallback (matches the legacy `getListingDetailData` shape
 * but exposed as a clean DAL function per docs/DATA_ACCESS_LAYER.md):
 *
 *   1. `public.listing_photos` table — our normalized per-listing photo
 *      store. Populated for our own listings + ones we backfill. Empty
 *      for most MLS listings.
 *   2. `public.listings.details->'Photos'` JSONB — raw MLS payload
 *      object array (Uri300 / Uri640 / Uri800 / Uri1024 / Uri1280 /
 *      Uri1600 / Uri2048 / UriLarge / UriThumb / Caption / Primary).
 *      Populated for every active listing via the Spark sync.
 *   3. `public.listings.PhotoURL` — single hero photo URL. Always
 *      present as long as the listing has any photo at all.
 *
 * Returns an empty array when all three tiers are empty.
 *
 * Per CLAUDE.md §0: cache-friendly, listing-tile cache window. Reads
 * through supabaseAnon so it is safe to call inside `unstable_cache`.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import type { ListingPhoto } from '@/lib/data/types/listing'

const InputSchema = z.object({ listingKey: z.string().min(1).max(100) })

type DetailsPhotoJson = {
  Uri300?: string
  Uri640?: string
  Uri800?: string
  Uri1024?: string
  Uri1280?: string
  Uri1600?: string
  Uri2048?: string
  UriLarge?: string
  UriThumb?: string
  Caption?: string | null
  Primary?: boolean
}

function pickBestUri(p: DetailsPhotoJson): string | null {
  return (
    p.Uri1600 ??
    p.UriLarge ??
    p.Uri2048 ??
    p.Uri1280 ??
    p.Uri1024 ??
    p.Uri800 ??
    p.Uri640 ??
    p.Uri300 ??
    null
  )
}

async function fetchPhotos(listingKey: string): Promise<ListingPhoto[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  // Tier 1 — listing_photos table.
  const { data: rows } = await sb
    .from('listing_photos')
    .select('photo_url, cdn_url, sort_order, caption')
    .eq('listing_key', listingKey)
    .order('sort_order', { ascending: true })
    .limit(50)

  if (rows && rows.length > 0) {
    return (rows as unknown as Array<Record<string, unknown>>).map((r, i) => ({
      url: (r.cdn_url as string | null) ?? (r.photo_url as string),
      caption: (r.caption as string | null) ?? null,
      order: (r.sort_order as number | null) ?? i,
    }))
  }

  // Tier 2 — listings.details.Photos JSONB.
  const { data: detail } = await sb
    .from('listings')
    .select('details, "PhotoURL"')
    .eq('"ListingKey"', listingKey)
    .maybeSingle()

  const details = (detail as { details?: { Photos?: DetailsPhotoJson[] } } | null)?.details
  const photosJson = Array.isArray(details?.Photos) ? details.Photos : null
  if (photosJson && photosJson.length > 0) {
    const out: ListingPhoto[] = []
    for (let i = 0; i < photosJson.length; i++) {
      const p = photosJson[i]
      const url = pickBestUri(p)
      if (!url) continue
      const caption = p.Caption && p.Caption.trim().length > 0 ? p.Caption : null
      out.push({ url, caption, order: i })
    }
    if (out.length > 0) return out
  }

  // Tier 3 — single PhotoURL fallback.
  const heroUrl = (detail as { PhotoURL?: string | null } | null)?.PhotoURL
  if (heroUrl) {
    return [{ url: heroUrl, caption: null, order: 0 }]
  }

  return []
}

export const getListingPhotos = (listingKey: string): Promise<ListingPhoto[]> => {
  InputSchema.parse({ listingKey })
  return unstable_cache(
    () => fetchPhotos(listingKey),
    ['listing-photos', listingKey],
    {
      revalidate: CACHE_WINDOWS.listingTile,
      tags: [cacheTag.listings, cacheTag.listing(listingKey)],
    },
  )()
}
