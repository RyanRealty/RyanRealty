import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/maps/cma-21042-robin
 *
 * Branded Google Maps Static image for the 21042 Robin Ave CMA showing
 * subject + 8 Whispering Pines comparable sales as numbered pins.
 * Marker numbers (1–8) correspond to the comp flyer page order in the
 * CMA deliverable at /drafts/cma-21042-robin/cma.html.
 *
 * Subject pin: red with "S" label (the CMA subject).
 * Comp pins: navy (#102742, brand primary) labeled 1–8.
 *
 * Returns: image/png streamed from Google; cached at the CDN for 1 hr.
 *
 * (Uses Google Maps Static API because NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 * is configured on Vercel; Mapbox would be preferred for styling but
 * its token isn't provisioned yet.)
 */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set' },
      { status: 500 }
    )
  }

  // Coordinates verified against Supabase listings.Latitude/Longitude
  // for each ListingKey. Order here matches the comp flyer order
  // (pages 6–13 of the CMA).
  const subject = { lat: 44.162857, lng: -121.271963 } // 21042 Robin
  const comps: Array<{ label: string; lat: number; lng: number }> = [
    { label: '1', lat: 44.169454, lng: -121.291765 }, // 65258 Old Bend Redmond
    { label: '2', lat: 44.170781, lng: -121.270682 }, // 65299 85th
    { label: '3', lat: 44.166815, lng: -121.274346 }, // 65195 85th
    { label: '4', lat: 44.180663, lng: -121.258233 }, // 21305 Gift
    { label: '5', lat: 44.169249, lng: -121.26827 }, // 65318 85th
    { label: '6', lat: 44.182567, lng: -121.272298 }, // 21037 Gift
    { label: '7', lat: 44.16127, lng: -121.264747 }, // 65030 78th
    { label: '8', lat: 44.160531, lng: -121.281245 }, // 65025 92nd
  ]

  // Minimal brand-leaning style: cream-ish background, hide POI noise,
  // soft road/admin lines so markers read clearly.
  const styleParams: string[] = [
    'feature:poi|visibility:off',
    'feature:transit|visibility:off',
    'feature:landscape.natural|element:geometry|color:0xeae3d6',
    'feature:landscape.man_made|element:geometry|color:0xf2ebdd',
    'feature:water|element:geometry|color:0xd6dde1',
    'feature:road|element:geometry.stroke|color:0xc9c2b3',
    'feature:road|element:labels.text.fill|color:0x5b5b5b',
    'feature:administrative|element:labels.text.fill|color:0x102742',
    'feature:administrative.land_parcel|visibility:off',
  ]

  const params = new URLSearchParams()
  params.set('size', '640x360')
  params.set('scale', '2') // → effective 1280×720
  params.set('maptype', 'roadmap')
  params.append('markers', `color:red|label:S|size:mid|${subject.lat},${subject.lng}`)
  for (const c of comps) {
    params.append('markers', `color:0x102742|label:${c.label}|size:mid|${c.lat},${c.lng}`)
  }
  for (const s of styleParams) {
    params.append('style', s)
  }
  params.set('key', key)

  const googleUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`

  const res = await fetch(googleUrl, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `Google Maps ${res.status}`, detail: text.slice(0, 300) },
      { status: 502 }
    )
  }
  const buffer = await res.arrayBuffer()
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
