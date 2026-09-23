/**
 * GET /api/atlas/dots — an Atlas's dots, after paint (UXLIVE-3, visibility
 * audit 2026-09-22).
 *
 * Place pages used to serialize every listing on their map into the RSC
 * payload: 5,650 dot records (2.0 MB) on /about, 1,664 (594 KB) on
 * /cities/bend, plus the sales-heat cells drawn from them in the server SVG
 * (558 KB on /cities/bend). Field LCP p75 sat at 9.9 s on neighborhood pages.
 * The page now renders the Atlas's counts, boundaries and text on the server
 * (lib/atlas/atlas-derive.ts summarizeAtlasDots) and V3Atlas fetches the dots
 * from here once the page has painted.
 *
 * Same data by construction: the query names the scope the page read
 * (lib/atlas/atlas-dots-scope.ts), the boundary is resolved through the same
 * cached DAL call the page made, and the population comes from the same
 * cached core (buildAtlasDots in lib/atlas/build-place-atlas.ts).
 *
 * CDN-cacheable: a complete read is public for five minutes at the edge
 * with an hour of stale-while-revalidate (the population's own cache window
 * is two minutes; the page it belongs to revalidates every 15 to 60). A
 * short read is never cached anywhere.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { buildAtlasDots, hashAtlasBoundary } from '@/lib/atlas/build-place-atlas'
import { parseAtlasDotsScope } from '@/lib/atlas/atlas-dots-scope'
import { resolveAtlasBoundaryRef } from '@/lib/atlas/atlas-boundary-ref'

const CACHEABLE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'
const NO_STORE = 'no-store'

export async function GET(request: NextRequest) {
  const scope = parseAtlasDotsScope(request.nextUrl.searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'bad scope' }, { status: 400, headers: { 'Cache-Control': NO_STORE } })
  }
  try {
    const boundary = scope.boundary ? await resolveAtlasBoundaryRef(scope.boundary) : null
    if (scope.boundary && !boundary) {
      return NextResponse.json({ error: 'no boundary' }, { status: 404, headers: { 'Cache-Control': NO_STORE } })
    }
    const { dots, stamp, complete } = await buildAtlasDots({ cities: scope.cities, boundary })
    return NextResponse.json(
      { dots, stamp, complete, boundary: hashAtlasBoundary(boundary) },
      { headers: { 'Cache-Control': complete ? CACHEABLE : NO_STORE } },
    )
  } catch (error) {
    console.error('[api/atlas/dots]', error)
    return NextResponse.json({ error: 'read failed' }, { status: 503, headers: { 'Cache-Control': NO_STORE } })
  }
}
