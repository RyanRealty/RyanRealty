'use client'

import type { HTMLAttributes } from 'react'

/**
 * Badge variants use design-token colors for consistency.
 * Semantic map: urgent = Hot/Open house; success = New/Deal; warning = Pending/Notice; accent/navy = Premium/Sold.
 * See docs/BADGE_AND_EMOJI_GUIDE.md for color psychology and emoji usage on tiles.
 */
export type BadgeVariant =
  | 'hot'
  | 'trending'
  | 'new'
  | 'price-drop'
  | 'pending'
  | 'sold'
  | 'property-type'

const variantClasses: Record<BadgeVariant, string> = {
  hot: 'bg-[var(--urgent)] text-white',
  trending: 'bg-[var(--color-cta)] text-[var(--color-primary)]',
  new: 'bg-[var(--success)] text-white',
  'price-drop': 'bg-[var(--warning)] text-[var(--color-primary)]',
  pending: 'bg-[var(--warning)] text-[var(--color-primary)]',
  sold: 'bg-[var(--color-primary)] text-white',
  'property-type': 'bg-[var(--color-border-navy-light)] text-[var(--color-primary)]',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant
}

export default function Badge({ variant, className = '', ...props }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        variantClasses[variant],
        className,
      ].join(' ')}
      {...props}
    />
  )
}
