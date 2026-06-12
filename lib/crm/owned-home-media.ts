/**
 * Owned-home media for the CRM person page — Google Static Maps + Street View
 * imagery of the home a lead owns, from the geocoded point in fub_person_geo.
 *
 * The Street View metadata endpoint is checked server-side first so we never
 * render the grey "no imagery" tile. Metadata calls are free; image loads are
 * billed per request — this renders on an authed admin page only.
 */

const MAPS_BASE = 'https://maps.googleapis.com/maps/api'

function mapsKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null
}

export type OwnedHomeMedia = {
  /** Hybrid (satellite + labels) static map centered on the home, navy marker. */
  mapUrl: string | null
  /** Street-level exterior photo, only when imagery exists within ~50m. */
  streetViewUrl: string | null
  /** Deep link to Google Maps for the point. */
  googleMapsLink: string
}

export async function getOwnedHomeMedia(lat: number, lng: number): Promise<OwnedHomeMedia> {
  const key = mapsKey()
  const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { mapUrl: null, streetViewUrl: null, googleMapsLink }
  }

  const mapParams = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '18',
    size: '640x320',
    scale: '2',
    maptype: 'hybrid',
    markers: `color:0x102742|${lat},${lng}`,
    key,
  })
  const mapUrl = `${MAPS_BASE}/staticmap?${mapParams.toString()}`

  // Street View imagery check (metadata endpoint is unbilled).
  let streetViewUrl: string | null = null
  try {
    const metaParams = new URLSearchParams({ location: `${lat},${lng}`, radius: '50', source: 'outdoor', key })
    const res = await fetch(`${MAPS_BASE}/streetview/metadata?${metaParams.toString()}`, {
      next: { revalidate: 86400 },
    })
    const meta = (await res.json()) as { status?: string }
    if (meta.status === 'OK') {
      const svParams = new URLSearchParams({
        location: `${lat},${lng}`,
        size: '640x320',
        radius: '50',
        source: 'outdoor',
        fov: '75',
        key,
      })
      streetViewUrl = `${MAPS_BASE}/streetview?${svParams.toString()}`
    }
  } catch {
    // metadata unreachable → skip street view, keep the map
  }

  return { mapUrl, streetViewUrl, googleMapsLink }
}
