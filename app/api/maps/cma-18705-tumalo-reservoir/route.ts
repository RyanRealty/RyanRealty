import { NextResponse } from 'next/server'
import { fetchCmaMapPngBuffer } from '@/lib/cma-map'

export const dynamic = 'force-dynamic'

/**
 * GET /api/maps/cma-18705-tumalo-reservoir
 *
 * Branded Google Maps Static image for the 18705 Tumalo Reservoir Rd land CMA
 * showing the subject + 6 comparable land sales as numbered pins.
 * Marker numbers (1–6) correspond to comp flyer page order in the CMA
 * deliverable at /drafts/cma-18705-tumalo-reservoir/cma.html.
 *
 * Subject (S): 44.132914, -121.391158 — from MLS ListingKey 20200227073204120207000000
 * Comp 1: 18313 Tumalo Reservoir Rd (0.8 mi)
 * Comp 2: 18425 Pinehurst (1.0 mi)
 * Comp 3: 64859 Collins Rd (1.7 mi)
 * Comp 4: 64145 Old Bend Redmond Hwy (3.7 mi)
 * Comp 5: 65799 93rd St (6.5 mi)
 * Comp 6: 61955 Somerset (10.2 mi)
 *
 * All point coordinates live in lib/cma-map.ts.
 */
export async function GET() {
  const buf = await fetchCmaMapPngBuffer('cma-18705-tumalo-reservoir')
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
