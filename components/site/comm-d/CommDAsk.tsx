import { CONTACT } from '@/lib/brand/contact'

export function CommDAsk({
  name,
  rating,
  reviewCount,
}: {
  name: string
  rating: number
  reviewCount: number
}) {
  const showRating = rating > 0 && reviewCount > 0
  const ratingLabel = Number.isInteger(rating) ? rating.toFixed(1) : String(rating)
  return (
    <section className="comm-d-askband" aria-labelledby="comm-d-ask">
      <div className="comm-d-wrap">
        <h2 id="comm-d-ask" className="comm-d-display">
          Ask me about {name}
        </h2>
        {showRating ? (
          <a className="comm-d-askband-rating" href="/reviews">
            {ratingLabel} · {reviewCount.toLocaleString('en-US')} Google reviews
          </a>
        ) : null}
        <a className="comm-d-askband-phone" href={`tel:${CONTACT.phoneDirectTel}`}>
          {CONTACT.phoneDirect}
        </a>
        <div className="comm-d-askband-actions">
          <a className="comm-d-btn" href={`tel:${CONTACT.phoneDirectTel}`}>
            Call
          </a>
          <a className="comm-d-btn comm-d-btn-ghost" href={`sms:${CONTACT.phoneDirectTel}`}>
            Text
          </a>
        </div>
      </div>
    </section>
  )
}
