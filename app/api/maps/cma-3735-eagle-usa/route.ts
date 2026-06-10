import { NextResponse } from 'next/server'
import { fetchCmaMapPngBuffer } from '@/lib/cma-map'

export const dynamic = 'force-dynamic'

/**
 * GET /api/maps/cma-3735-eagle-usa
 *
 * Branded Google Maps Static image for the 3735 Eagle Rd CMA showing the
 * off-market subject + 8 closed comparable sales inside Petrosa (Bend OR
 * 97701) as numbered pins. Marker numbers (1–8) correspond to comp flyer
 * page order in the CMA deliverable.
 *
 * All point coordinates + map builder logic live in lib/cma-map.ts so the
 * PDF endpoint can inline the same map as a data URI.
 */
export async function GET() {
  const buf = await fetchCmaMapPngBuffer('cma-3735-eagle-usa')
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
