/**
 * getLeaseLeadPhotos — the photo each commercial lease's card leads with: the
 * first of its listing photos that is a photograph of the space.
 *
 * WHY (2026-10-01). A lease card led with the MLS primary photo, which on
 * commercial listings is often a map capture, a plan or a render (Redmond's
 * largest lease led with its lot-line plan; 423 SW 6th Street with a Street
 * View frame). listingLeadPhotograph (lib/listing/listing-photo-kind.ts) reads
 * the names and captions the listing filed and picks the first photograph.
 *
 * THE READ. Keyed by ListingKey, restricted to PropertyType 'G', selecting the
 * name, caption and 1600px URL of the first LEAD_PHOTO_SCAN photos as named
 * json paths (`details->Photos->i->>Name`, never the payload; getLeaseTerms'
 * pattern). Verified by row reads on 2026-10-01: 20251103221639770887000000
 * files ["Lot Line Adjustments", "midstate fertilizer aerial"];
 * 20260909221957492351000000 files ["423 SW 6th street view2", "423 SW 6th St
 * Aerial2", "reimagined as a bike shop" (caption "AI reimagined as a bike
 * shop")].
 *
 * WHAT COMES BACK. ListingKey → the lead photograph's URL, or null when the
 * listing files photos and none of the first LEAD_PHOTO_SCAN is a photograph
 * (the card shows its no-photograph face). A key the read did not return, or
 * whose payload carries no photos, is absent: the caller keeps the tile's own
 * photo.
 *
 * NEVER BLOCKS A PAGE. A database error throws inside the cache so a blip is
 * never cached as "no photos"; the resilient wrapper retries once uncached and
 * then returns {}, and every lease keeps its tile photo.
 */
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { listingLeadPhotograph, type ListingPhotoFiled } from '@/lib/listing/listing-photo-kind'

/** ListingKey → the lead photograph's URL, or null when none is a photograph. */
export type LeaseLeadPhotosByKey = Record<string, string | null>

/** How many of a listing's photos are read for its lead (most lead within two). */
export const LEAD_PHOTO_SCAN = 8

const KEY_CHUNK = 200
const MAX_KEYS = 1000

const PHOTO_COLUMNS = Array.from({ length: LEAD_PHOTO_SCAN }, (_, i) =>
  [`n${i}:details->Photos->${i}->>Name`, `c${i}:details->Photos->${i}->>Caption`, `u${i}:details->Photos->${i}->>Uri1600`].join(', '),
).join(', ')

type LeasePhotoRow = { ListingKey: string | null } & Record<string, unknown>

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The row's filed photos, in order, up to the first index with no URL. */
export function leasePhotosFromRow(row: Readonly<Record<string, unknown>>): ListingPhotoFiled[] {
  const photos: ListingPhotoFiled[] = []
  for (let i = 0; i < LEAD_PHOTO_SCAN; i += 1) {
    const url = text(row[`u${i}`])
    if (!url) break
    photos.push({ name: text(row[`n${i}`]), caption: text(row[`c${i}`]), url })
  }
  return photos
}

async function fetchLeaseLeadPhotos(keys: string[]): Promise<LeaseLeadPhotosByKey> {
  const sb = supabaseAnon()
  if (!sb) return {}
  const out: LeaseLeadPhotosByKey = {}
  for (let i = 0; i < keys.length; i += KEY_CHUNK) {
    const chunk = keys.slice(i, i + KEY_CHUNK)
    const { data, error } = await sb
      .from('listings')
      .select(`ListingKey, ${PHOTO_COLUMNS}`)
      .eq('PropertyType', 'G')
      .in('ListingKey', chunk) // @canonical-key: callers pass listing_tile_mv.listing_key, the MLS ListingKey
    if (error) {
      throw new Error(`[getLeaseLeadPhotos] supabase error: ${error.message}`)
    }
    for (const row of (data ?? []) as unknown as LeasePhotoRow[]) {
      const key = row.ListingKey?.trim()
      if (!key) continue
      const photos = leasePhotosFromRow(row)
      if (photos.length === 0) continue
      out[key] = listingLeadPhotograph(photos)
    }
  }
  return out
}

const cachedLeaseLeadPhotos = makeResilientCached(
  fetchLeaseLeadPhotos,
  ['lease-lead-photos-v1'],
  { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
  {} as LeaseLeadPhotosByKey,
)

/** The lead photograph for each commercial-lease key given. Never throws: a failure reads as {}. */
export async function getLeaseLeadPhotos(listingKeys: readonly string[]): Promise<LeaseLeadPhotosByKey> {
  const keys = [...new Set(listingKeys.map((key) => key?.trim()).filter(Boolean))]
    .sort()
    .slice(0, MAX_KEYS)
  if (keys.length === 0) return {}
  try {
    return await cachedLeaseLeadPhotos(keys)
  } catch {
    return {}
  }
}
