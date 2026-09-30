import { NextResponse } from 'next/server'
import { getListingCardVideo, LISTING_CARD_VIDEO_KEY } from '@/lib/data'

/**
 * GET /api/listings/[listingKey]/card-video
 *
 * The one reel a listing card plays after the reader rests on it (the listing
 * dial, Matt 2026-09-24): `{ video: { kind, embedType, url, posterUrl } }`,
 * or `{ video: null }` when the listing has no reel a card can play silently.
 * The reel is the one the listing page leads with (publishListingHeroVideo:
 * walkthroughs only, never a 3D tour). One listing per request; pages never
 * read a card's video on the server.
 *
 * CACHING. The answer is CDN-cacheable for an hour and the browser keeps it
 * ten minutes, so a reader turning back to a card, or the next reader on the
 * same page, costs nothing. Behind the CDN, getListingCardVideo holds it in
 * unstable_cache on the listing's tag. A failed read is `503` with no-store:
 * an empty from an outage is never pinned at the edge as "no video".
 */

const CACHEABLE = 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400'

export async function GET(
  _request: Request,
  context: { params: Promise<{ listingKey: string }> },
) {
  const { listingKey } = await context.params
  const key = String(listingKey ?? '').trim()
  if (!LISTING_CARD_VIDEO_KEY.test(key)) {
    return NextResponse.json({ video: null }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  const { video, degraded } = await getListingCardVideo(key)
  if (degraded) {
    return NextResponse.json({ video: null }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ video }, { headers: { 'Cache-Control': CACHEABLE } })
}
