import Link from 'next/link'
import { cn } from '@/lib/utils'
import { findParksNear, type ParkType } from '@/data/co-parks'
import { getParkBoundaryGeoJSON } from '@/lib/data'
import { PlaceListThumb } from '@/components/site/PlaceListThumb'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * Parks nearby — Redfin slot on listing detail. List thumbs are always a map
 * from existing geo (boundary when we have it, otherwise the park point).
 */

type Props = {
  listing: Pick<ListingDetail, 'lat' | 'lng'>
  className?: string
}

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

function formatMiles(miles: number): string {
  return `${miles.toFixed(1)} mi`
}

export async function ParksNearbyBlock({ listing, className }: Props) {
  const { lat, lng } = listing
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const parks = findParksNear(lat, lng, 3, 6)
  if (parks.length === 0) return null

  const geos = await Promise.all(
    parks.map((park) =>
      park.hasPolygon ? getParkBoundaryGeoJSON(park.slug).catch(() => null) : Promise.resolve(null),
    ),
  )

  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Outdoors</div>
          <h2 className="sec-title display">Parks nearby</h2>
        </div>
      </div>

      <div className="place-list">
        {parks.map((park, i) => (
          <Link key={park.slug} href={`/parks/${park.slug}`} className="place-list__row">
            <PlaceListThumb lat={park.lat} lng={park.lng} geometry={geos[i]} />
            <span className="place-list__copy">
              <span className="place-list__name">{park.name}</span>
              <span className="place-list__meta">
                <span>{TYPE_LABEL[park.type]}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{formatMiles(park.distanceMiles)}</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
