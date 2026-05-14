import { NextResponse } from 'next/server'
import { fetchSparkListingByKey, type SparkPhoto } from '@/lib/spark'

export const dynamic = 'force-dynamic'

/**
 * GET /api/listings/[listingKey]/photos
 *
 * Fetches photo URLs for a single listing directly from Spark via the legacy
 * `/v1/listings/{key}?_expand=Photos` endpoint. Used when `listings.PhotoURL`
 * is null and `listing_photos` has no rows (sparse-sync edge case).
 *
 * Returns: { listingKey, photosCount, photos: [{ id?, primary?, url, urlLarge? }] }
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

  const accessToken = process.env.SPARK_API_KEY?.trim()
  if (!accessToken) {
    return NextResponse.json({ error: 'SPARK_API_KEY is not set' }, { status: 500 })
  }

  try {
    const response = await fetchSparkListingByKey(accessToken, key, 'Photos')
    const result = response?.D?.Results?.[0]
    if (!result) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    const fields = (result.StandardFields ?? {}) as Record<string, unknown>
    const photosRaw = Array.isArray(fields.Photos) ? (fields.Photos as SparkPhoto[]) : []
    const photos = photosRaw.map((p, i) => ({
      id: typeof p.Id === 'string' ? p.Id : null,
      order: i,
      primary: Boolean(p.Primary),
      url:
        p.Uri1600 ??
        p.Uri1280 ??
        p.Uri1024 ??
        p.Uri800 ??
        p.Uri640 ??
        p.Uri300 ??
        p.UriThumb ??
        null,
      urlLarge: p.Uri2048 ?? p.UriLarge ?? p.Uri1600 ?? null,
      caption: typeof p.Caption === 'string' ? p.Caption : null,
    }))
    return NextResponse.json({
      listingKey: key,
      photosCount: photos.length,
      photos,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
