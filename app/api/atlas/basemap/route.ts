/**
 * GET /api/atlas/basemap — the roads, rivers and lakes under an Atlas, after
 * paint (UXLIVE-3, visibility audit 2026-09-22).
 *
 * Static public-domain TIGER/Line geometry that ships in the repo
 * (data/basemap, lib/geo/basemap-source.ts). A page names its frame in the
 * query (lib/atlas/atlas-basemap-href.ts); this returns the same clipped,
 * thinned, still-encoded subset basemapForFrame gives the page, so the map
 * draws exactly what it drew when the page inlined it. Nothing here reads a
 * database, so the response is cached hard: a day in the browser, a week at
 * the edge (a new deployment starts a fresh edge cache).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { basemapForFrame } from '@/lib/geo/basemap-source'
import { parseAtlasBasemapFrame } from '@/lib/atlas/atlas-basemap-href'

const CACHEABLE = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'

export function GET(request: NextRequest) {
  const frame = parseAtlasBasemapFrame(request.nextUrl.searchParams)
  if (!frame) {
    return NextResponse.json({ error: 'bad frame' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json(basemapForFrame(frame), { headers: { 'Cache-Control': CACHEABLE } })
}
