'use client'

import Link from 'next/link'
import type { HomeDPark } from './types'

export function HomeDParks({
  featured,
  parks,
  note,
}: {
  featured: HomeDPark
  parks: HomeDPark[]
  note?: string | null
}) {
  const rest = parks.filter((p) => p.slug !== featured.slug)

  return (
    <section className="home-d-section home-d-parks" id="parks">
      {featured.img ? (
        <Link href={featured.href} className="home-d-parks-media" aria-label={featured.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={featured.img} alt="" />
          <span className="home-d-parks-scrim" aria-hidden="true" />
          <span className="home-d-parks-name">
            <h2 className="home-d-display">{featured.name}</h2>
            {featured.detail ? <p>{featured.detail}</p> : null}
          </span>
        </Link>
      ) : (
        <div className="home-d-wrap">
          <h2 className="home-d-display">{featured.name}</h2>
        </div>
      )}
      {rest.length > 0 ? (
        <ul className="home-d-parks-list">
          {rest.map((p) => (
            <li key={p.slug}>
              <Link href={p.href}>
                <span>{p.name}</span>
                {p.detail || p.city ? <span className="home-d-parks-side">{p.detail || p.city}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="home-d-parks-note">{note}</p> : null}
    </section>
  )
}
