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

type DetailRow = { ListingKey?: string | null; details?: { Photos?: DetailsPhotoJson[] } | null; PhotoURL?: string | null; media_suppressed?: boolean | null }

async function fetchPhotos(listingKey: string): Promise<ListingPhoto[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  // Resolve the listings row by EITHER the MLS ListNumber (which the canonical
  // /homes-for-sale/<...>/<addr>-<listnum> URLs carry) OR the RETS ListingKey,
  // and read the canonical key + both photo sources in one shot. The prior code
  // keyed every tier by ListingKey only, so a listing opened via its ListNumber
  // pretty-URL (the common path) matched nothing in details.Photos and the entire
  // gallery collapsed to the single PhotoURL hero. ListNumber first = one query
  // for the common pretty-URL case; ListingKey second covers raw-key access.
  let detail = (await sb
    .from('listings')
    .select('ListingKey, details, PhotoURL, media_suppressed')
    .eq('ListNumber', listingKey)
    .maybeSingle()).data as DetailRow | null
  if (!detail) {
    detail = (await sb
      .from('listings')
      .select('ListingKey, details, PhotoURL, media_suppressed')
      .eq('ListingKey', listingKey)
      .maybeSingle()).data as DetailRow | null
  }
  const canonicalKey = String(detail?.ListingKey ?? listingKey).trim()

  // Owner media-removal request: when the listing is flagged media_suppressed,
  // the public site shows NO photos for it (gallery + hero collapse). See
  // migration 20260618121500_add_media_suppressed.sql. Checked here (not just by
  // emptying the data) because the Spark sync re-pulls details.Photos/PhotoURL on
  // every delta/full sync — the flag is the durable, sync-proof gate.
  if (detail?.media_suppressed === true) return []

  // Tier 1 — our normalized listing_photos table (keyed by the canonical ListingKey).
  const { data: rows } = await sb
    .from('listing_photos')
    .select('photo_url, cdn_url, sort_order, caption')
    .eq('listing_key', canonicalKey)
    .order('sort_order', { ascending: true })
    .limit(50)

  if (rows && rows.length > 0) {
    return (rows as unknown as Array<Record<string, unknown>>).map((r, i) => ({
      url: (r.cdn_url as string | null) ?? (r.photo_url as string),
      caption: (r.caption as string | null) ?? null,
      order: (r.sort_order as number | null) ?? i,
    }))
  }

  // Tier 2 — listings.details.Photos JSONB (the raw MLS payload — most listings).
  const photosJson = Array.isArray(detail?.details?.Photos) ? detail.details.Photos : null
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
  const heroUrl = detail?.PhotoURL
  if (heroUrl) {
    return [{ url: heroUrl, caption: null, order: 0 }]
  }

  return []
}

export const getListingPhotos = (listingKey: string): Promise<ListingPhoto[]> => {
  InputSchema.parse({ listingKey })
  return unstable_cache(
    () => fetchPhotos(listingKey),
    // v2 cache-key bump 2026-05-28 — paired with getListingDetail v2
    // bump to invalidate empty photo arrays cached during the
    // column-quoting bug window.
    // v3 bump 2026-06-08 — invalidate single-PhotoURL-fallback entries cached
    // when the ListNumber lookup missed details.Photos (every pretty-URL listing).
    // v4 bump 2026-06-18 — media_suppressed gate added (owner photo-removal
    // requests); evicts entries cached before the suppression check existed.
    ['listing-photos-v4', listingKey],
    {
      revalidate: CACHE_WINDOWS.listingTile,
      tags: [cacheTag.listings, cacheTag.listing(listingKey)],
    },
  )()
}
