import { lifestyleNearByKind } from '@/lib/explore/lifestyle-near'
import { LifestyleNearSection } from './LifestyleNearSection'

/** Parks and trails near this house. Same thumbs as the indexes. */
export async function ListingAroundHere({
  lat,
  lng,
}: {
  lat: number | null | undefined
  lng: number | null | undefined
  city?: string | null | undefined
}) {
  const grouped = lifestyleNearByKind(lat, lng)
  const items = [...grouped.parks, ...grouped.trails]
  if (items.length === 0) return null
  return <LifestyleNearSection lat={lat} lng={lng} items={items} />
}
