/**
 * Pure shaping for the listing photo sitemaps at /sitemaps/listing-photos/{n}.xml
 * (2026-10-14). No IO: the DAL (getListingSitemapPhotos) reads, this shapes.
 *
 * WHY SEPARATE FILES. /sitemaps/listings.xml carries one <image:image> per
 * listing (the lead photo) for ~8,800 listing URLs. Every photo, capped at
 * LISTING_SITEMAP_PHOTO_CAP, is ~4.5 KB of XML per listing: ~40 MB for the
 * whole set in one file. That is under Google's 50 MB / 50,000-URL limits but
 * far over a Vercel Function's 4.5 MB response body and unstable_cache's 2 MB
 * entry, so the full gallery ships in LISTING_PHOTO_SITEMAP_PARTS files, each
 * listing in exactly one. A listing URL appearing in listings.xml and in one
 * photo part is allowed (Google merges overlapping sitemaps).
 *
 * WHY A FIXED PART COUNT. The index route does no data work (it must not
 * prerender a DB read: app/sitemaps/index.xml/route.ts), so it cannot ask how
 * many parts exist. A listing's part is a stable hash of its ListingKey, so the
 * index lists 1..N without reading anything and every part is ~1/N of the
 * inventory. At 24 parts and ~8,800 listings a part is ~370 listings, ~1.7 MB.
 * Raise the count when on-market inventory passes ~20,000.
 *
 * ODS §3-13: every image URL is the MLS's own CDN (Spark), the same URL the
 * listing page loads. Nothing is copied or re-hosted.
 */
import { LISTING_MOSAIC_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'

/** Fixed number of photo sitemap files listed by the sitemap index. */
export const LISTING_PHOTO_SITEMAP_PARTS = 24

/** Photos per listing in its photo sitemap entry (Google allows 1,000). */
export const LISTING_SITEMAP_PHOTO_CAP = 30

/** One `details.Photos[]` entry as the Spark sync stores it. */
export type SparkPhotoJson = {
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
}

/**
 * The gallery's size preference (getListingPhotos uses the same order): the
 * 1600 render first, the largest otherwise. Null when the entry has no URI.
 */
export function pickBestListingPhotoUri(p: SparkPhotoJson | null | undefined): string | null {
  if (!p || typeof p !== 'object') return null
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

/** 32-bit FNV-1a. Stable across deploys and runtimes (no Node crypto). */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** The photo sitemap part (1..LISTING_PHOTO_SITEMAP_PARTS) a listing lives in. */
export function listingPhotoSitemapPart(listingKey: string): number {
  return (fnv1a(listingKey.trim()) % LISTING_PHOTO_SITEMAP_PARTS) + 1
}

/** Parse a `/sitemaps/listing-photos/{n}.xml` segment; null when out of range. */
export function parseListingPhotoSitemapPart(segment: string): number | null {
  const m = /^(\d{1,3})(?:\.xml)?$/.exec(segment.trim())
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= LISTING_PHOTO_SITEMAP_PARTS ? n : null
}

/**
 * A listing's sitemap photos in gallery order: the 1600x1200 Spark render the
 * listing page's lead and lightbox load, https only, de-duplicated, capped.
 * Falls back to the lead PhotoURL when the payload has no photo list.
 */
export function listingSitemapPhotoUrls(
  photos: unknown,
  leadPhotoUrl: string | null | undefined,
  cap: number = LISTING_SITEMAP_PHOTO_CAP,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string | null | undefined) => {
    const src = typeof raw === 'string' ? raw.trim() : ''
    if (!src.startsWith('https://')) return
    const sized = listingRowPhotoSrc(src, LISTING_MOSAIC_LEAD_PHOTO_SIZE)
    if (seen.has(sized)) return
    seen.add(sized)
    out.push(sized)
  }
  if (Array.isArray(photos)) {
    for (const p of photos) {
      if (out.length >= cap) break
      push(pickBestListingPhotoUri(p as SparkPhotoJson))
    }
  }
  if (out.length === 0) push(leadPhotoUrl)
  return out
}
