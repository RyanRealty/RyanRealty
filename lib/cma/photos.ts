/**
 * CMA comp/subject photo recovery.
 *
 * The deterministic builder reads `listings.PhotoURL` (a single cached cover
 * photo). Older closed comps were backfilled without that field even though
 * Spark still holds their full photo set (photos_count 50+), so their comp
 * flyer rendered a blank hero. When PhotoURL is null we fetch the primary photo
 * straight from Spark (`/v1/listings/{key}?_expand=Photos`, the same path the
 * photos API uses) and stamp it onto the comp so the flyer has a hero.
 *
 * Fail-open: no Spark key, a fetch error, or a genuinely photoless listing
 * leaves photoUrl null and the render falls back to a styled placeholder.
 */

import { fetchSparkListingByKey, type SparkPhoto } from '@/lib/spark'

function bestUri(p: SparkPhoto): string | null {
  return p.Uri1024 ?? p.Uri1280 ?? p.Uri1600 ?? p.Uri800 ?? p.Uri640 ?? p.Uri300 ?? p.UriThumb ?? null
}

/** Primary (or first) photo URL for a listing, fetched live from Spark. */
export async function fetchPrimaryPhotoUrl(listingKey: string): Promise<string | null> {
  const token = process.env.SPARK_API_KEY?.trim()
  if (!token || !listingKey) return null
  try {
    const resp = await fetchSparkListingByKey(token, listingKey, 'Photos')
    const fields = (resp?.D?.Results?.[0]?.StandardFields ?? {}) as Record<string, unknown>
    const photos = Array.isArray(fields.Photos) ? (fields.Photos as SparkPhoto[]) : []
    if (photos.length === 0) return null
    const primary = photos.find((p) => p.Primary) ?? photos[0]
    return bestUri(primary)
  } catch (err) {
    console.warn('[cma/photos] primary photo fetch failed for', listingKey, err instanceof Error ? err.message : String(err))
    return null
  }
}

/** In-place: fill photoUrl on any item (comp or subject) that is missing one,
 *  fetched in parallel from Spark. Returns the same array. */
export async function hydratePhotoUrls<T extends { listingKey: string | null; photoUrl: string | null }>(
  items: T[],
): Promise<T[]> {
  const missing = items.filter((it): it is T & { listingKey: string } => !it.photoUrl && !!it.listingKey)
  if (missing.length === 0) return items
  await Promise.all(
    missing.map(async (it) => {
      it.photoUrl = await fetchPrimaryPhotoUrl(it.listingKey)
    }),
  )
  return items
}
