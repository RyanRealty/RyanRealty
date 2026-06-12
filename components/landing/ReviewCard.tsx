/**
 * ReviewCard — a single Google review card for LP social proof.
 *
 * Extracted from SellerSocialProof (components/seller-lp/SellerSocialProof.tsx)
 * so it can be reused on the expired LP and buyer LP without importing the
 * full animated fader. Uses only verified reviews from lib/testimonials.ts.
 *
 * Server component — no client interactivity needed for static display.
 */

import { cn } from '@/lib/utils'
import type { Testimonial } from '@/lib/testimonials'

type Props = {
  review: Testimonial
  /** Color register. `light` = navy text on cream. `dark` = light text on navy. */
  tone?: 'light' | 'dark'
  className?: string
}

export function ReviewCard({ review, tone = 'light', className }: Props) {
  const isLight = tone === 'light'
  return (
    <figure
      className={cn(
        'rounded-2xl border p-5',
        isLight
          ? 'border-primary/10 bg-card'
          : 'border-card/10 bg-card/10',
        className,
      )}
    >
      {/* Five stars */}
      <div
        className="flex items-center gap-0.5"
        role="img"
        aria-label="Rated five out of five stars"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="text-xl leading-none text-warning"
            aria-hidden="true"
          >
            ★
          </span>
        ))}
      </div>

      {/* Quote */}
      <blockquote className="mt-3">
        <p
          className={cn(
            'line-clamp-4 text-sm leading-relaxed italic',
            isLight ? 'text-foreground/85' : 'text-card/90',
          )}
        >
          "{review.quote}"
        </p>
        <footer
          className={cn(
            'mt-2 not-italic text-xs font-medium',
            isLight ? 'text-muted-foreground' : 'text-card/70',
          )}
        >
          {review.author} · {review.source} review
        </footer>
      </blockquote>
    </figure>
  )
}

/**
 * ReviewStrip — a 1-up (mobile) / 2-up (desktop) strip of reviews.
 * Pass 2 reviews for the best visual balance. Falls back gracefully if
 * fewer are provided.
 */
export function ReviewStrip({
  reviews,
  tone = 'light',
  className,
}: {
  reviews: Testimonial[]
  tone?: 'light' | 'dark'
  className?: string
}) {
  if (reviews.length === 0) return null
  const shown = reviews.slice(0, 2)
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4',
        shown.length >= 2 && 'sm:grid-cols-2',
        className,
      )}
    >
      {shown.map((r) => (
        <ReviewCard key={r.author} review={r} tone={tone} />
      ))}
    </div>
  )
}
