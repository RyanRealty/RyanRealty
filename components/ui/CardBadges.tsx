'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/**
 * Smart badges for card media (e.g. listing, community, city).
 * Renders in a single row top-left; use priority order so the most important badges show.
 * Prevents overlap by limiting to one row and using consistent spacing.
 * Uses shadcn Badge with design token styling.
 */

export type CardBadgeItem = {
  /** Short label, e.g. "Hot", "New", "Resort" */
  label: string
  /** Token-based style */
  variant: 'hot' | 'new' | 'price-drop' | 'resort' | 'open-house' | 'days' | 'media' | 'trending' | 'popular' | 'steady'
  /** Optional emoji or icon (single char or small SVG) - use sparingly for clarity */
  icon?: React.ReactNode
}

const variantClasses: Record<CardBadgeItem['variant'], string> = {
  hot: 'bg-destructive text-destructive-foreground',
  new: 'bg-success text-success-foreground',
  'price-drop': 'bg-warning text-warning-foreground',
  resort: 'bg-accent text-accent-foreground',
  'open-house': 'bg-destructive text-destructive-foreground',
  days: 'bg-card text-foreground',
  media: 'bg-black/70 text-white',
  trending: 'bg-accent text-accent-foreground',
  popular: 'bg-warning text-white',
  steady: 'bg-black/60 text-white',
}

export type CardBadgesProps = {
  /** Badges in priority order; only first N are shown (max 3, no wrap). */
  items: CardBadgeItem[]
  /** Max badges to show in one row (default 3, never more than 3). */
  max?: number
  /** Position: top-left (default) or bottom-left. */
  position?: 'top-left' | 'bottom-left'
  className?: string
}

const MAX_BADGES = 3

export default function CardBadges({ items, max = 3, position = 'top-left', className }: CardBadgesProps) {
  const cappedMax = Math.min(max, MAX_BADGES)
  const show = items.slice(0, cappedMax)
  if (show.length === 0) return null

  const posClass = position === 'top-left'
    ? 'left-2 top-2'
    : 'bottom-2 left-2'

  return (
    <div
      className={cn('absolute z-10 flex max-w-[85%] flex-nowrap items-center gap-1.5 overflow-hidden', posClass, className)}
      aria-hidden
    >
      {show.map((item, i) => (
        <Badge
          key={`${item.label}-${i}`}
          className={cn('shrink-0 gap-1 rounded-md px-2 py-1 text-xs font-semibold shadow-sm', variantClasses[item.variant])}
        >
          {item.icon != null && <span className="flex items-center">{item.icon}</span>}
          {item.label}
        </Badge>
      ))}
    </div>
  )
}
