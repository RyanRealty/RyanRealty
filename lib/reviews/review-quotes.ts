/**
 * Map live GBP reviews (getReviews) onto the quotes the page renders.
 * TESTIMONIALS is the empty-pool fallback, the same verified Google set
 * team pages already use. Never invent a quote or a name.
 */
import { formatDate } from '@/lib/format/date'
import { TESTIMONIALS } from '@/lib/testimonials'
import type { Review } from '@/lib/data'

export type ReviewQuote = {
  id: string
  quote: string
  /** The first sentence, whole — never a cut. */
  pull: string
  /** Every sentence after the first, as paragraphs. */
  rest: string[]
  author: string
  date: string | null
  /** From the date; the current year when the review carries none. */
  year: number
  /** 0–11, from the date; 0 when the review carries none. */
  month: number
  rating: number
  attribution: string
}

/** The first sentence and the rest of a review, with nothing removed. */
export function splitPull(text: string): { pull: string; rest: string[] } {
  const paras = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (paras.length === 0) return { pull: text.trim(), rest: [] }
  const first = paras[0]!
  const m = first.match(/^([\s\S]+?[.!?])(\s+)([\s\S]+)$/)
  if (!m) return { pull: first, rest: paras.slice(1) }
  return { pull: m[1]!, rest: [m[3]!, ...paras.slice(1)] }
}

function partsOf(date: string | null): { year: number; month: number } {
  const m = date?.match(/^(\d{4})-(\d{2})/)
  if (!m) return { year: new Date().getFullYear(), month: 0 }
  return { year: Number(m[1]), month: Math.max(0, Math.min(11, Number(m[2]) - 1)) }
}

const EM_DASH = '\u2014'

function attributionFor(date: string | null): string {
  const stamp = formatDate(date, { month: 'short', day: undefined, year: 'numeric' })
  if (stamp && stamp !== EM_DASH) return `Verified Google review, ${stamp}`
  return 'Verified Google review'
}

function fromLive(review: Review, i: number): ReviewQuote | null {
  const quote = review.text.trim()
  const author = review.reviewerName?.trim()
  if (!quote || !author) return null
  const rating = Number(review.rating)
  return {
    id: `g${i}`,
    quote,
    ...splitPull(quote),
    author,
    date: review.reviewDate,
    ...partsOf(review.reviewDate),
    rating: Number.isFinite(rating) ? rating : 5,
    attribution: attributionFor(review.reviewDate),
  }
}

function fromTestimonials(): ReviewQuote[] {
  return TESTIMONIALS.map((t, i) => ({
    id: `t${i}`,
    quote: t.quote,
    ...splitPull(t.quote),
    author: t.author,
    date: t.date,
    ...partsOf(t.date),
    rating: 5,
    attribution: attributionFor(t.date),
  }))
}

export function toReviewQuotes(live: readonly Review[]): ReviewQuote[] {
  const fromGbp = live.map((r, i) => fromLive(r, i)).filter((row): row is ReviewQuote => row !== null)
  return fromGbp.length > 0 ? fromGbp : fromTestimonials()
}
