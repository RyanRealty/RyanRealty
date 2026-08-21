import Link from 'next/link'
import type { CityDNearbyPlace } from './types'

export function CityDNearby({
  cityName,
  places,
}: {
  cityName: string
  places: CityDNearbyPlace[]
}) {
  if (places.length === 0) return null
  return (
    <section className="city-d-section" aria-labelledby="city-d-nearby">
      <div className="city-d-wrap">
        <span className="city-d-eyebrow">Nearby</span>
        <h2 id="city-d-nearby" className="city-d-display">
          Also on the list
        </h2>
        <p className="city-d-prose">
          Named places people look at with {cityName}. Official community names
          only.
        </p>
        <div className="city-d-nearby-grid">
          {places.map((place) => (
            <Link key={place.href} href={place.href} className="city-d-nearby-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={place.img} alt="" />
              <div className="city-d-nearby-scrim" aria-hidden="true" />
              <div className="city-d-nearby-meta">
                <span className="city-d-nearby-name city-d-display">{place.name}</span>
                <span className="city-d-nearby-town">{place.town}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
