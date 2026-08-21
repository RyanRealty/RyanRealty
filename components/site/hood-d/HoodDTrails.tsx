import Link from 'next/link'
import type { HoodDPlace } from './types'

export function HoodDTrails({
  heading,
  kicker,
  photos,
  list,
  note,
}: {
  heading: string
  kicker?: string | null
  photos: HoodDPlace[]
  list: HoodDPlace[]
  note?: string | null
}) {
  if (photos.length === 0 && list.length === 0) return null

  return (
    <section className="hood-d-section" id="trails">
      <div className="hood-d-wrap">
        <div className="hood-d-section-head">
          <span className="hood-d-eyebrow">Parks and trails</span>
          <h2 className="hood-d-display">{heading}</h2>
          {kicker ? <p className="hood-d-kicker">{kicker}</p> : null}
        </div>
        {photos.length > 0 ? (
          <div className="hood-d-tiles">
            {photos.map((place) => {
              const inner = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={place.img ?? ''} alt="" />
                  <span className="hood-d-tile-scrim" aria-hidden="true" />
                  <span className="hood-d-tile-name">{place.name}</span>
                </>
              )
              return place.href ? (
                <Link key={place.name} href={place.href} className="hood-d-tile">
                  {inner}
                </Link>
              ) : (
                <div key={place.name} className="hood-d-tile">
                  {inner}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
      {list.length > 0 ? (
        <div className={photos.length > 0 ? 'hood-d-wrap hood-d-trails-list' : 'hood-d-wrap'}>
          <ul className="hood-d-list">
            {list.map((place) => {
              const side = place.detail
              const body = (
                <>
                  <span>{place.name}</span>
                  {side ? <span className="hood-d-list-side">{side}</span> : null}
                </>
              )
              return (
                <li key={place.name}>
                  {place.href ? <Link href={place.href}>{body}</Link> : body}
                </li>
              )
            })}
          </ul>
          {note ? <p className="hood-d-note">{note}</p> : null}
        </div>
      ) : note ? (
        <div className="hood-d-wrap">
          <p className="hood-d-note">{note}</p>
        </div>
      ) : null}
    </section>
  )
}
