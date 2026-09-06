import { toReviewQuotes } from '@/lib/reviews/review-quotes'
import type { ReviewsSummary } from '@/lib/data'
import type { V3ProofQuote } from '@/components/site/v3'

export function sellReviewState(reviewSummary: ReviewsSummary | null): {
  reviewQuotes: V3ProofQuote[]
  reviewCount: number
  reviewAverage: number
  newestReview: string | null
} {
  const mapped = reviewSummary ? toReviewQuotes(reviewSummary.reviews).slice(0, 4) : []
  const reviewQuotes: V3ProofQuote[] = mapped.map((q) => ({
    id: q.id,
    pull: q.pull,
    rest: q.rest,
    author: q.author,
    attribution: q.attribution,
    rating: q.rating,
    year: q.year,
    month: q.month,
  }))
  const reviewCount =
    reviewSummary && reviewSummary.count > 0 ? reviewSummary.count : reviewQuotes.length
  const reviewAverage =
    reviewSummary && reviewSummary.count > 0 ? reviewSummary.averageRating : 5
  const newestReview = mapped.find((q) => q.date)?.date ?? null
  return { reviewQuotes, reviewCount, reviewAverage, newestReview }
}
