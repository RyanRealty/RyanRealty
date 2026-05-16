import { NextResponse } from 'next/server'
import { fetchCmaMapPngBuffer } from '@/lib/cma-map'

export const dynamic = 'force-dynamic'

/**
 * GET /api/maps/cma-19496-tumalo-reservoir
 *
 * Branded Google Maps Static image for the 19496 Tumalo Reservoir Rd CMA
 * showing the subject + 5 distance-based comparable sales as numbered pins.
 * Marker numbers (1–5) correspond to comp flyer page order in the CMA
 * deliverable at /drafts/cma-19496-tumalo-reservoir/cma.html.
 *
 * All point coordinates + map builder logic live in lib/cma-map.ts so the
 * PDF endpoint can inline the same map as a data URI.
 */
export async function GET() {
  const buf = await fetchCmaMapPngBuffer('cma-19496-tumalo-reservoir')
  if (!buf) {
    return NextResponse.json(
      { error: 'Map unavailable — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY missing or upstream error' },
      { status: 500 }
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
