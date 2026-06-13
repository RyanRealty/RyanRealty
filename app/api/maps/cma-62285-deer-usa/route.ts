import { NextResponse } from 'next/server'
import { fetchCmaMapPngBuffer } from '@/lib/cma-map'

export const dynamic = 'force-dynamic'

/**
 * GET /api/maps/cma-62285-deer-usa
 *
 * Branded Google Maps Static image for the 62285 Deer Trail Rd CMA showing the
 * off-market subject + 6 closed comparable sales in the rural 97701 corridor.
 * Marker numbers (1–6) correspond to comp flyer page order in the CMA.
 *
 * Note: Subject coordinates are estimated from the Deer Trail corridor pattern.
 * Update lib/cma-map.ts with verified lat/lng from DIAL or county GIS before
 * finalizing delivery.
 */
export async function GET() {
  const buf = await fetchCmaMapPngBuffer('cma-62285-deer-usa')
  if (!buf) {
    return NextResponse.json(
      { error: 'Map unavailable — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing or upstream error' },
      { status: 500 },
    )
  }
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
