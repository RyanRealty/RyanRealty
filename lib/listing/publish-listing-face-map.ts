/**
 * Tiny static map on the listing face. Same leftover lat/lng as the
 * full location section. Miss omits — no key or no point, no chip.
 */

const MAPS = 'https://maps.googleapis.com/maps/api/staticmap'

export function publishListingFaceMapSrc(input: {
  lat?: number | null
  lng?: number | null
  key?: string | null
}): string | null {
  const lat = input.lat
  const lng = input.lng
  const key = input.key?.trim() ?? ''
  if (!key || lat == null || lng == null) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '14',
    size: '240x240',
    scale: '2',
    maptype: 'roadmap',
    markers: `color:0x102742|${lat},${lng}`,
    key,
  })
  return `${MAPS}?${params.toString()}`
}
