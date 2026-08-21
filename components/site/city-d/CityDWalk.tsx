import { CONTACT } from '@/lib/brand/contact'

export function CityDWalk({
  cityName,
  rating,
  count,
}: {
  cityName: string
  rating: number
  count: number
}) {
  const ratingLabel = rating > 0 && count > 0 ? rating.toFixed(1) : null
  return (
    <section className="city-d-walk" aria-labelledby="city-d-walk">
      <div className="city-d-wrap city-d-walk-row">
        <div>
          <h2 id="city-d-walk" className="city-d-display">
            Walk {cityName} with me
          </h2>
          {ratingLabel ? (
            <p>
              {ratingLabel} · {count.toLocaleString('en-US')} Google reviews
            </p>
          ) : (
            <p>The number on the house, or the one below.</p>
          )}
        </div>
        <div>
          <a className="city-d-walk-phone city-d-display" href={`tel:${CONTACT.phoneDirectTel}`}>
            {CONTACT.phoneDirect}
          </a>
          <div className="city-d-walk-actions">
            <a className="city-d-walk-call" href={`tel:${CONTACT.phoneDirectTel}`}>
              Call
            </a>
            <a className="city-d-walk-text" href={`sms:${CONTACT.phoneDirectTel}`}>
              Text
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
