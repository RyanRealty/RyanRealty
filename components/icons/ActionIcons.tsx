'use client'

/**
 * Shared Heroicons for share, like, and save actions.
 * All use the same 24/outline (and 24/solid for filled states) so stroke weight and style match.
 * Share uses ArrowUpTrayIcon so it reads as "share" and matches the single-shape look of heart/bookmark.
 */

import {
  ArrowUpTrayIcon as ShareGlyphOutline,
  HeartIcon as HeartOutline,
  BookmarkIcon as BookmarkOutline,
} from '@heroicons/react/24/outline'
import {
  HeartIcon as HeartSolid,
  BookmarkIcon as BookmarkSolid,
} from '@heroicons/react/24/solid'

const sizeClass = 'size-5'

export function ShareIcon({ className }: { className?: string }) {
  return <ShareGlyphOutline className={className ?? sizeClass} aria-hidden />
}

export function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  const c = className ?? sizeClass
  return filled ? <HeartSolid className={c} aria-hidden /> : <HeartOutline className={c} aria-hidden />
}

export function BookmarkIcon({ filled, className }: { filled: boolean; className?: string }) {
  const c = className ?? sizeClass
  return filled ? <BookmarkSolid className={c} aria-hidden /> : <BookmarkOutline className={c} aria-hidden />
}
