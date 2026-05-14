import { NextResponse } from 'next/server'
import { fetchSingleListing } from '@/lib/spark-odata'

export const dynamic = 'force-dynamic'

/**
 * GET /api/listings/[listingKey]/photos
 *
 * Fetches photo URLs for a single listing directly from the Spark OData feed
 * via $expand=Media. Used when `listings.PhotoURL` is null and
 * `listing_photos` has no rows for the key (sparse-sync edge case).
 *
 * Returns: { listingKey, photosCount, photos: [{ order, url, category? }] }
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ listingKey: string }> }
) {
  const { listingKey } = await context.params
  const key = String(listingKey ?? '').trim()
  if (!key) {
    return NextResponse.json({ error: 'Missing listingKey' }, { status: 400 })
  }

  const listing = await fetchSingleListing(key)
  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const media = Array.isArray(listing.Media) ? listing.Media : []
  const photos = media
    .filter((m) => typeof m.MediaURL === 'string' && m.MediaURL.length > 0)
    .map((m) => ({
      order: typeof m.Order === 'number' ? m.Order : null,
      url: m.MediaURL as string,
      category: typeof m.MediaCategory === 'string' ? m.MediaCategory : null,
    }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))

  return NextResponse.json({
    listingKey: key,
    photosCount: typeof listing.PhotosCount === 'number' ? listing.PhotosCount : photos.length,
    photos,
  })
}
