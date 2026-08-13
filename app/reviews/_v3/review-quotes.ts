/**
 * Map live GBP reviews (getReviews) onto the quotes the page renders.
 * TESTIMONIALS is the empty-pool fallback, the same verified Google set
 * team pages already use. Never invent a quote or a name.
 */
import { formatDate } from '@/lib/format/date'
import { TESTIMONIALS } from '@/lib/testimonials'
import type { Review } from '@/lib/data'

export type ReviewQuote = {
  quote: string
  author: string
  date: string | null
  rating: number
  attribution: string
}

const EM_DASH = '\u2014'

function attributionFor(date: string | null): string {
  const stamp = formatDate(date, { month: 'short', day: undefined, year: 'numeric' })
  if (stamp && stamp !== EM_DASH) return `Verified Google review, ${stamp}`
  return 'Verified Google review'
}

function fromLive(review: Review): ReviewQuote | null {
  const quote = review.text.trim()
  const author = review.reviewerName?.trim()
  if (!quote || !author) return null
  const rating = Number(review.rating)
  return {
    quote,
    author,
    date: review.reviewDate,
    rating: Number.isFinite(rating) ? rating : 5,
    attribution: attributionFor(review.reviewDate),
  }
}

function fromTestimonials(): ReviewQuote[] {
  return TESTIMONIALS.map((t) => ({
    quote: t.quote,
    author: t.author,
    date: t.date,
    rating: 5,
    attribution: attributionFor(t.date),
  }))
}

export function toReviewQuotes(live: readonly Review[]): ReviewQuote[] {
  const fromGbp = live.map(fromLive).filter((row): row is ReviewQuote => row !== null)
  return fromGbp.length > 0 ? fromGbp : fromTestimonials()
}
