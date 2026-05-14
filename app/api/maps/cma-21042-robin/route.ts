import { NextResponse } from 'next/server'
import { fetchCmaMapPngBuffer } from '@/lib/cma-map'

export const dynamic = 'force-dynamic'

/**
 * GET /api/maps/cma-21042-robin
 *
 * Branded Google Maps Static image for the 21042 Robin Ave CMA showing
 * subject + 8 Whispering Pines comparable sales as numbered pins.
 * Marker numbers (1–8) correspond to the comp flyer page order in the
 * CMA deliverable at /drafts/cma-21042-robin/cma.html.
 *
 * All point coordinates + map builder logic lives in lib/cma-map.ts so
 * the PDF endpoint can inline the same map as a data URI.
 */
export async function GET() {
  const buf = await fetchCmaMapPngBuffer('cma-21042-robin')
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
