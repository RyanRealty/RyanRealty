'use client'

import type { HTMLAttributes } from 'react'

export type SkeletonVariant =
  | 'card'
  | 'listing-detail-hero'
  | 'text-line'
  | 'avatar'
  | 'chart'

const variantClasses: Record<SkeletonVariant, string> = {
  card: 'aspect-[4/3] w-full rounded-t-xl',
  'listing-detail-hero': 'aspect-video w-full rounded-t-xl',
  'text-line': 'h-4 w-full max-w-[200px] rounded',
  avatar: 'h-12 w-12 rounded-full',
  chart: 'h-48 w-full rounded-[var(--radius-card)]',
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant: SkeletonVariant
}

export default function Skeleton({ variant, className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={[
        'animate-pulse bg-[var(--gray-border)]',
        variantClasses[variant],
        className,
      ].join(' ')}
      aria-hidden
      {...props}
    />
  )
}
