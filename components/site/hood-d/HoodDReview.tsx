import Link from 'next/link'
import type { HoodDReview } from './types'

export function HoodDReview({
  review,
  rating,
  count,
}: {
  review: HoodDReview | null
  rating: number
  count: number
}) {
  if (!review) return null
  const showRating = rating > 0 && count > 0

  return (
    <section className="hood-d-section hood-d-review" id="reviews">
      <div className="hood-d-wrap">
        {showRating ? (
          <p className="hood-d-eyebrow">
            Google · {Number.isInteger(rating) ? rating.toFixed(1) : String(rating)} · {count} reviews
          </p>
        ) : (
          <span className="hood-d-eyebrow">Google review</span>
        )}
        <blockquote>
          <p>{review.quote}</p>
          <footer>{review.author}</footer>
        </blockquote>
        <p className="hood-d-note">
          <Link href="/reviews">More reviews</Link>
        </p>
      </div>
    </section>
  )
}
