'use client'

/**
 * Smart badges for card media (e.g. listing, community, city).
 * Renders in a single row top-left; use priority order so the most important badges show.
 * Prevents overlap by limiting to one row and using consistent spacing.
 * Uses design tokens from globals.css (--urgent, --success, --warning, --accent, etc.).
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
  hot: 'bg-[var(--urgent)] text-white',
  new: 'bg-[var(--success)] text-white',
  'price-drop': 'bg-[var(--warning)] text-[var(--color-primary)]',
  resort: 'bg-[var(--color-cta)] text-[var(--color-primary)]',
  'open-house': 'bg-[var(--urgent)] text-white',
  days: 'bg-white/95 text-[var(--text-primary)]',
  media: 'bg-black/70 text-white',
  trending: 'bg-[var(--color-cta)] text-[var(--color-primary)]',
  popular: 'bg-[var(--color-warning)]/100/95 text-white',
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

export default function CardBadges({ items, max = 3, position = 'top-left', className = '' }: CardBadgesProps) {
  const cappedMax = Math.min(max, MAX_BADGES)
  const show = items.slice(0, cappedMax)
  if (show.length === 0) return null

  const posClass = position === 'top-left'
    ? 'left-2 top-2'
    : 'bottom-2 left-2'

  return (
    <div
      className={`absolute z-10 flex max-w-[85%] flex-nowrap items-center gap-1.5 overflow-hidden ${posClass} ${className}`}
      aria-hidden
    >
      {show.map((item, i) => (
        <span
          key={`${item.label}-${i}`}
          className={`inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-input)] px-2 py-1 text-xs font-semibold shadow ${variantClasses[item.variant]}`}
        >
          {item.icon != null && <span className="flex items-center">{item.icon}</span>}
          {item.label}
        </span>
      ))}
    </div>
  )
}
