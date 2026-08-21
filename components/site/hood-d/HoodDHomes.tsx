import Link from 'next/link'
import type { HoodDHome } from './types'

export function HoodDHomes({
  name,
  homes,
  listHref,
  mapHref,
}: {
  name: string
  homes: HoodDHome[]
  listHref: string
  mapHref: string
}) {
  if (homes.length === 0) return null

  return (
    <section className="hood-d-section" id="homes">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">For sale</span>
          <h2 className="hood-d-display">Homes in {name}</h2>
        </div>
        <div className="hood-d-homes-grid">
          {homes.map((home) => (
            <Link key={home.href} href={home.href} className="hood-d-home-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={home.img} alt="" width={480} height={320} />
              <span className="hood-d-home-price">{home.priceLabel}</span>
              <span className="hood-d-home-addr">{home.address}</span>
              {home.meta ? <span className="hood-d-home-meta">{home.meta}</span> : null}
            </Link>
          ))}
        </div>
        <div className="hood-d-homes-actions">
          <Link href={listHref}>See homes in {name}</Link>
          <Link href={mapHref}>Open map</Link>
        </div>
      </div>
    </section>
  )
}
