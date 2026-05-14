import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/maps/cma-21042-robin
 *
 * Branded Mapbox Static Images map for the 21042 Robin Ave CMA showing
 * subject + 8 Whispering Pines comparable sales as numbered pins.
 * Marker numbers (1–8) correspond to the comp flyer page order in the
 * CMA deliverable at /drafts/cma-21042-robin/cma.html.
 *
 * Subject pin: gold star (#d4af37, brand accent).
 * Comp pins: navy (#102742, brand primary) numbered 1–8.
 *
 * Returns: image/png streamed from Mapbox; cached at the CDN for 1 hr.
 */
export async function GET() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim()
  if (!token) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN not set' }, { status: 500 })
  }

  // Coordinates verified against Supabase listings.Latitude/Longitude
  // for each ListingKey. Order here matches the comp flyer order
  // (pages 6–13 of the CMA).
  const points: Array<{ label: string; color: string; lng: number; lat: number }> = [
    { label: 'star', color: 'd4af37', lng: -121.271963, lat: 44.162857 }, // subject — 21042 Robin
    { label: '1', color: '102742', lng: -121.291765, lat: 44.169454 }, // 65258 Old Bend Redmond
    { label: '2', color: '102742', lng: -121.270682, lat: 44.170781 }, // 65299 85th
    { label: '3', color: '102742', lng: -121.274346, lat: 44.166815 }, // 65195 85th
    { label: '4', color: '102742', lng: -121.258233, lat: 44.180663 }, // 21305 Gift
    { label: '5', color: '102742', lng: -121.26827, lat: 44.169249 }, // 65318 85th
    { label: '6', color: '102742', lng: -121.272298, lat: 44.182567 }, // 21037 Gift
    { label: '7', color: '102742', lng: -121.264747, lat: 44.16127 }, // 65030 78th
    { label: '8', color: '102742', lng: -121.281245, lat: 44.160531 }, // 65025 92nd
  ]

  const overlay = points
    .map((p) => `pin-l-${p.label}+${p.color}(${p.lng},${p.lat})`)
    .join(',')

  // mapbox/light-v11 = clean, low-contrast base; print-friendly.
  // auto-fit with 80px padding so markers don't clip the edges.
  const styleId = 'mapbox/light-v11'
  const width = 1280
  const height = 720
  const mapboxUrl =
    `https://api.mapbox.com/styles/v1/${styleId}/static/${overlay}` +
    `/auto/${width}x${height}@2x` +
    `?padding=80&access_token=${encodeURIComponent(token)}`

  const res = await fetch(mapboxUrl, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return NextResponse.json(
      { error: `Mapbox ${res.status}`, detail: text.slice(0, 300) },
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
