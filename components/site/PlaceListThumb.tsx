import { publishPlaceListThumb } from '@/lib/place/publish-place-list-thumb'

/**
 * Map thumb for a park or trail list row. Always present. Boundary or path
 * when the caller already has that geo; otherwise a navy pin on cream.
 * Detail pages keep the live map — this is the list slot only.
 */
export function PlaceListThumb({
  lat,
  lng,
  geometry,
}: {
  lat?: number | null
  lng?: number | null
  geometry?: unknown
}) {
  const thumb = publishPlaceListThumb({ lat, lng, geometry })
  return (
    <span
      className="place-list-thumb"
      data-thumb-kind={thumb.kind}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: thumb.svg }}
    />
  )
}
