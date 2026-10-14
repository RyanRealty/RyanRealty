/**
 * GET /api/place/homes?community=<slug>
 *
 * The homes a /communities/[slug] page listed, after paint. The page seeds
 * one SSR_GRID_PAGE of cards; PlaceSubdivisionMap fetches the rest so a
 * long community (Sunriver, Eagle Crest) does not serialize every row into
 * the RSC payload. Same population as the page (lib/place/community-population.ts).
 *
 * CDN-cacheable when the read completed: public for a minute at the browser,
 * five at the edge, an hour of stale-while-revalidate.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { communityHomesResponse } from '@/lib/place/community-homes-response'
import { isCommunitySlug } from '@/lib/place/place-homes-src'

const CACHEABLE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
const NO_STORE = 'no-store'

export async function GET(request: NextRequest) {
  const slug = (request.nextUrl.searchParams.get('community') ?? '').trim()
  if (!isCommunitySlug(slug)) {
    return NextResponse.json({ error: 'bad community' }, { status: 400, headers: { 'Cache-Control': NO_STORE } })
  }
  try {
    const payload = await communityHomesResponse(slug)
    if (!payload) {
      return NextResponse.json({ error: 'no community' }, { status: 404, headers: { 'Cache-Control': NO_STORE } })
    }
    return NextResponse.json(payload, { headers: { 'Cache-Control': CACHEABLE } })
  } catch (error) {
    console.error('[api/place/homes]', error)
    return NextResponse.json({ error: 'read failed' }, { status: 503, headers: { 'Cache-Control': NO_STORE } })
  }
}
