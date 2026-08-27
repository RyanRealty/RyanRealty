/**
 * lib/data/studio/listing-photos.ts — the real photo set for a listing.
 *
 * `listing_photos` looked like the right table and is not: 4,124 rows across
 * 76 listings with `classification` null throughout, so most listings are not
 * in it and none of it is labelled. The full set lives on
 * `listings.details.Photos`, 41 entries for the listing this was built
 * against, each with sized URIs and a Privacy flag.
 *
 * Two suppressions are honoured here and neither is optional:
 *   - `media_suppressed` on the listing is the owner's photo-removal flag.
 *   - `Privacy` on the photo itself must read Public.
 * A seller who asked for their photos to come down does not get a film made
 * out of them.
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveCanonicalListingKey } from '@/lib/data/listings/resolveCanonicalListingKey'

export type ListingPhoto = {
  /** Largest URI available. This is the plate we animate. */
  url: string
  /**
   * A small copy, used only for grading. Vision is billed on image tokens:
   * grading at 2048px measured $0.07 a frame against well under a cent at
   * 800px, and the question we ask ("what room is this, can it hold a move")
   * does not need the pixels.
   */
  gradeUrl: string
  order: number
  isPrimary: boolean
}

type RawPhoto = {
  Id?: string
  Primary?: boolean
  Privacy?: string
  CurrentPrivacy?: string
  Uri2048?: string
  UriLarge?: string
  Uri1600?: string
  Uri1280?: string
  Uri1024?: string
  Uri800?: string
}

/** Largest first: a bigger plate survives the push with more detail. */
function bestUri(photo: RawPhoto): string | null {
  for (const key of ['Uri2048', 'UriLarge', 'Uri1600', 'Uri1280', 'Uri1024', 'Uri800'] as const) {
    const value = photo[key]
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value
  }
  return null
}

/** Smallest usable copy, for the grading pass. */
function gradeUri(photo: RawPhoto): string | null {
  for (const key of ['Uri800', 'Uri1024', 'Uri1280', 'Uri1600'] as const) {
    const value = photo[key]
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value
  }
  return null
}

function isPublic(photo: RawPhoto): boolean {
  const privacy = String(photo.CurrentPrivacy ?? photo.Privacy ?? '').trim().toLowerCase()
  // Absent means the feed did not say, and we do not assume permission.
  return privacy === 'public'
}

/**
 * Public, animatable-resolution photos in MLS order.
 * Empty when the owner suppressed media, or when nothing qualifies.
 */
export async function getListingPhotos(
  listingKey: string,
  options: { limit?: number } = {},
): Promise<ListingPhoto[]> {
  const key = listingKey.trim()
  if (!key) return []
  const limit = Math.max(1, Math.min(60, options.limit ?? 24))

  try {
    // The caller may hand us an MLS ListNumber rather than a ListingKey, and the
    // two collide across listings — resolve before filtering (ci:listing-key-lookup).
    const canonicalKey = await resolveCanonicalListingKey(key)
    if (!canonicalKey) return []

    const sb = createServiceClient()
    const { data, error } = await sb
      .from('listings')
      .select('details, media_suppressed')
      .eq('ListingKey', canonicalKey)
      .maybeSingle()

    if (error) {
      console.error('[studio/listing-photos] read failed:', error.message)
      return []
    }
    if (!data) return []
    if (data.media_suppressed === true) return []

    const details = (data.details ?? {}) as { Photos?: unknown }
    const raw = Array.isArray(details.Photos) ? (details.Photos as RawPhoto[]) : []

    const photos: ListingPhoto[] = []
    for (const [index, entry] of raw.entries()) {
      if (!entry || typeof entry !== 'object') continue
      if (!isPublic(entry)) continue
      const url = bestUri(entry)
      if (!url) continue
      photos.push({
        url,
        gradeUrl: gradeUri(entry) ?? url,
        order: index,
        isPrimary: entry.Primary === true,
      })
      if (photos.length >= limit) break
    }
    return photos
  } catch (err) {
    console.error('[studio/listing-photos] threw:', err)
    return []
  }
}
