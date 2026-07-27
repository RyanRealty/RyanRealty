/**
 * Google Static Maps URL for the listing-detail hero map thumbnail.
 * Reuses NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (same key as Maps JS bootstrap).
 */

export function buildListingHeroStaticMapUrl(
  lat: number,
  lng: number,
  opts?: { size?: string; zoom?: number },
): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const size = opts?.size ?? '160x160'
  const zoom = opts?.zoom ?? 15
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size,
    scale: '2',
    maptype: 'roadmap',
    markers: `color:0x102742|${lat},${lng}`,
    key,
  })
  // Soft brand styling — POI/transit off so the pin reads clearly at thumb size.
  params.append('style', 'feature:poi|visibility:off')
  params.append('style', 'feature:transit|visibility:off')

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}
