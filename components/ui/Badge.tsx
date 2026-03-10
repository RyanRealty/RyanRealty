'use client'

import type { HTMLAttributes } from 'react'

export type BadgeVariant =
  | 'hot'
  | 'trending'
  | 'new'
  | 'price-drop'
  | 'pending'
  | 'sold'

const variantClasses: Record<BadgeVariant, string> = {
  hot: 'bg-[var(--urgent)] text-white',
  trending: 'bg-[var(--accent)] text-[var(--brand-navy)]',
  new: 'bg-[var(--success)] text-white',
  'price-drop': 'bg-[var(--success)] text-white',
  pending: 'bg-[var(--warning)] text-[var(--brand-navy)]',
  sold: 'bg-[var(--brand-navy)] text-white',
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
