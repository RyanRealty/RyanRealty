/**
 * GET /api/atlas/taxlots — lot lines inside one recorded boundary, fetched
 * only after a visitor selects a district on the Atlas (Matt 2026-09-23:
 * "have the dogs eyes rotate to follow it" ... "also make the mouse a
 * bright tennis ball" ... "maybe put streets and is possible lots").
 *
 * The county assessor's cadastral layer, through getTaxlotsInBoundary
 * (lib/data/geo/getTaxlots.ts) — not a survey; every response is capped and
 * simplified server-side, and the caller (V3Atlas) prints TAXLOT_DISCLAIMER
 * beside the map whenever it draws one of these lines (CLAUDE.md §0).
 *
 * Lazy and after-paint like its basemap and dots siblings (UXLIVE-3): a
 * district's lots never inflate the Atlas's initial props, only a browser
 * request made once that district is selected.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getTaxlotsInBoundary } from '@/lib/data/geo/getTaxlots'
import { parseAtlasTaxlotsScope } from '@/lib/atlas/atlas-taxlots-href'

const CACHEABLE = 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400'
const NO_STORE = 'no-store'

/** Capped for payload: a district's own lot count rarely nears this. */
const MAX_LOTS = 300

export async function GET(request: NextRequest) {
  const scope = parseAtlasTaxlotsScope(request.nextUrl.searchParams)
  if (!scope) {
    return NextResponse.json({ error: 'bad scope' }, { status: 400, headers: { 'Cache-Control': NO_STORE } })
  }
  try {
    const lots = await getTaxlotsInBoundary({
      geoType: scope.geoType,
      geoSlug: scope.geoSlug,
      maxLots: MAX_LOTS,
    })
    return NextResponse.json({ lots }, { headers: { 'Cache-Control': CACHEABLE } })
  } catch (error) {
    console.error('[api/atlas/taxlots]', error)
    return NextResponse.json({ error: 'read failed' }, { status: 503, headers: { 'Cache-Control': NO_STORE } })
  }
}
