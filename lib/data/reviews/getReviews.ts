/**
 * getReviews — Ryan Realty's verified Google Business Profile reviews, for use
 * as on-site social proof (the brokerage's reputation, not per-broker stats).
 *
 * DATA ACCURACY (CLAUDE.md §0): rows are REAL reviews ingested live from the GBP
 * (scripts/ingest-gbp-reviews.mjs, source='google'). No fabricated testimonials.
 * `is_hidden` lets a real review be curated off the site without deleting it.
 *
 * Returns the brokerage rating summary (count + average across ALL non-hidden
 * reviews) plus the most recent reviews that carry written text, for quote cards.
 */
import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type Review = {
  rating: number
  text: string
  reviewerName: string | null
  reviewDate: string | null
}

export type ReviewsSummary = {
  /** Reviews that carry written text, newest first, capped at `limit`. */
  reviews: Review[]
  /** Total non-hidden reviews (the badge count). */
  count: number
  /** Average rating across all non-hidden reviews, one decimal (e.g. 5.0). */
  averageRating: number
  source: 'google'
}

const EMPTY: ReviewsSummary = { reviews: [], count: 0, averageRating: 0, source: 'google' }

async function fetchReviews(limit: number): Promise<ReviewsSummary> {
  const sb = supabaseAnon()
  if (!sb) return EMPTY
  const { data, error } = await sb
    .from('reviews')
    .select('rating, text, reviewer_name, review_date')
    .eq('source', 'google')
    .eq('is_hidden', false)
    .order('review_date', { ascending: false, nullsFirst: false })
  if (error || !data || data.length === 0) return EMPTY

  const count = data.length
  const avg = data.reduce((s, r) => s + Number(r.rating ?? 0), 0) / count
  const averageRating = Math.round(avg * 10) / 10
  const reviews = data
    .filter((r) => typeof r.text === 'string' && r.text.trim().length > 0)
    .slice(0, limit)
    .map((r) => ({
      rating: Number(r.rating),
      text: String(r.text).trim(),
      reviewerName: r.reviewer_name ?? null,
      reviewDate: r.review_date ?? null,
    }))

  return { reviews, count, averageRating, source: 'google' }
}

export const getReviews = (limit = 6): Promise<ReviewsSummary> =>
  unstable_cache(
    () => fetchReviews(limit),
    ['reviews-google-v1', String(limit)],
    { revalidate: CACHE_WINDOWS.reviews, tags: [cacheTag.reviews] },
  )()
