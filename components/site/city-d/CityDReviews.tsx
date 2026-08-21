import Link from 'next/link'
import type { CityDReview } from './types'

export function CityDReviews({
  cityName,
  review,
  rating,
  count,
}: {
  cityName: string
  review: CityDReview | null
  rating: number
  count: number
}) {
  if (!review) return null
  const ratingLabel = rating > 0 ? rating.toFixed(1) : null
  return (
    <section className="city-d-section" aria-labelledby="city-d-reviews">
      <div className="city-d-wrap">
        <span className="city-d-eyebrow">From a seller</span>
        <h2 id="city-d-reviews" className="city-d-display">
          What clients wrote
        </h2>
        {ratingLabel && count > 0 ? (
          <p className="city-d-stars">
            {ratingLabel} · {count.toLocaleString('en-US')} Google reviews
          </p>
        ) : null}
        <article className="city-d-review">
          <blockquote>
            <p>{review.quote}</p>
          </blockquote>
          <footer>
            {review.author} · {review.source}
          </footer>
        </article>
        <p className="city-d-prose">
          <Link href="/reviews">Read every review</Link>
          {` for work in ${cityName} and across Central Oregon.`}
        </p>
      </div>
    </section>
  )
}
