'use client'

import { useState } from 'react'
import type { ReviewRow } from '@/app/actions/agents'
import { Badge } from '@/components/ui/badge'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Props = {
  brokerFirstName: string
  avgRating: number | null
  reviewCount: number
  reviews: ReviewRow[]
}

const REVIEW_TRUNCATE = 200
const REVIEWS_PER_PAGE = 10

function StarDisplay({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[...Array(full)].map((_, i) => (
        <span key={i} className="text-accent-foreground">★</span>
      ))}
      {half ? <span className="text-accent-foreground">★</span> : null}
      {[...Array(empty)].map((_, i) => (
        <span key={i} className="text-border">★</span>
      ))}
    </span>
  )
}

function sourceLabel(s: string): string {
  const t = s.toLowerCase()
  if (t === 'zillow') return 'Zillow'
  if (t === 'google') return 'Google'
  if (t === 'yelp') return 'Yelp'
  if (t === 'realtor') return 'Realtor.com'
  return s
}

function getSourceCounts(reviews: ReviewRow[]): { source: string; count: number }[] {
  const m = new Map<string, number>()
  for (const r of reviews) {
    const s = r.source || 'Other'
    m.set(s, (m.get(s) ?? 0) + 1)
  }
  return [...m.entries()].map(([source, count]) => ({ source, count }))
}

export default function BrokerReviews({
  brokerFirstName,
  avgRating,
  reviewCount,
  reviews,
}: Props) {
  const [sort, setSort] = useState<'newest' | 'highest' | 'lowest'>('newest')
  const [page, setPage] = useState(0)
  const sourceCounts = getSourceCounts(reviews)

  const sorted = [...reviews].sort((a, b) => {
    if (sort === 'newest') {
      const da = a.review_date ?? ''
      const db = b.review_date ?? ''
      return db.localeCompare(da)
    }
    if (sort === 'highest') return (b.rating ?? 0) - (a.rating ?? 0)
    return (a.rating ?? 0) - (b.rating ?? 0)
  })

  const start = page * REVIEWS_PER_PAGE
  const pageReviews = sorted.slice(start, start + REVIEWS_PER_PAGE)
  const totalPages = Math.ceil(sorted.length / REVIEWS_PER_PAGE)

  if (reviewCount === 0) return null

  return (
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-reviews-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="broker-reviews-heading" className="text-2xl font-bold tracking-tight text-primary">
          Client Reviews
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {avgRating != null && (
            <div className="flex items-center gap-2">
              <StarDisplay rating={avgRating} />
              <span className="text-lg font-semibold text-primary">
                {avgRating.toFixed(1)} out of 5
              </span>
              <span className="text-muted-foreground">— {reviewCount} reviews</span>
            </div>
          )}
        </div>
        {sourceCounts.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {sourceCounts.map((s) => `${s.count} from ${sourceLabel(s.source)}`).join(', ')}
          </p>
        )}
        <div className="mt-6 flex items-center gap-2">
          <Label htmlFor="review-sort" className="text-sm text-muted-foreground">Sort:</Label>
          <Select value={sort} onValueChange={(v) => { setSort(v as 'newest' | 'highest' | 'lowest'); setPage(0) }}>
            <SelectTrigger id="review-sort" className="rounded border border-border bg-card px-3 py-2 text-sm text-primary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="highest">Highest rated</SelectItem>
              <SelectItem value="lowest">Lowest rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ul className="mt-6 space-y-4">
          {pageReviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </ul>
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function ReviewCard({ review }: { review: ReviewRow }) {
  const [expanded, setExpanded] = useState(false)
  const text = review.text?.trim() ?? ''
  const truncated = text.length > REVIEW_TRUNCATE ? text.slice(0, REVIEW_TRUNCATE) + '…' : text
  const showMore = text.length > REVIEW_TRUNCATE

  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <StarDisplay rating={review.rating} />
        <Badge variant="secondary">
          {review.source}
        </Badge>
      </div>
      {text && (
        <p className="mt-2 text-foreground">
          {expanded ? text : truncated}
          {showMore && (
            <Button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="ml-1 text-sm font-medium text-accent-foreground hover:underline"
            >
              {expanded ? ' Less' : ' Read more'}
            </Button>
          )}
        </p>
      )}
      {(review.reviewer_name || review.review_date) && (
        <p className="mt-2 text-sm text-muted-foreground">
          {review.reviewer_name ?? 'Anonymous'}
          {review.review_date && ` · ${new Date(review.review_date).toLocaleDateString('en-US')}`}
        </p>
      )}
    </li>
  )
}
