import { NextResponse } from 'next/server'
import { getListingCardVideo } from '@/lib/data'

export const dynamic = 'force-dynamic'

/**
 * GET /api/listings/[listingKey]/card-video (SITE-194)
 *
 * The one reel a listing card may play after its photograph: the same
 * walkthrough the listing page leads with, resolved through the cached
 * per-listing videos read (getListingCardVideo), never a 3D tour. The dial
 * asks for it after a dwell on the card, so a place page's server render
 * carries no per-card video read.
 *
 * Returns { listingKey, reel: null | { kind, src, posterUrl? } }. A found
 * answer is CDN-cached for the videos window; a read that failed is served
 * once with no-store so an empty fallback is never pinned at the edge (the
 * cached-empty-fallback class, app/api/search/suggestions).
 */
export async function GET(_request: Request, context: { params: Promise<{ listingKey: string }> }) {
  const { listingKey } = await context.params
  const key = String(listingKey ?? '').trim()
  if (!key || key.length > 100) {
    return NextResponse.json({ error: 'Missing listingKey' }, { status: 400 })
  }
  try {
    const body = await getListingCardVideo(key)
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400' },
    })
  } catch {
    return NextResponse.json({ listingKey: key, reel: null }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
