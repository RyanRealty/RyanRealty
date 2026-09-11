'use client'

/**
 * beautifului InsightCards pager — title + count + prev/next — adapted for
 * house charts. V3Chart uses this to isolate one year page at a time.
 * Not an AI insight card; navy/cream paint lives on the house wrapper.
 *
 * Source: https://www.beautifului.dev/r/insight-cards.json (pager chrome only).
 */

import { cn } from '@/lib/utils'
import './insight-pager.css'

export type InsightPagerProps = {
  /** Section label, e.g. "Year". */
  title: string
  /** Page labels in order (year names). */
  pages: readonly string[]
  /** Active page index. */
  page: number
  onPage: (index: number) => void
  className?: string
}

export function InsightPager({ title, pages, page, onPage, className }: InsightPagerProps) {
  if (pages.length < 2) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const move = (direction: -1 | 1) => {
    onPage((safe + direction + pages.length) % pages.length)
  }

  return (
    <div className={cn('insight-pager', className)} role="group" aria-label={`${title} pages`}>
      <span className="insight-pager__face">
        <span className="insight-pager__title">{title}</span>
        <span className="insight-pager__current tabular-nums">{pages[safe]}</span>
        <span className="insight-pager__count tabular-nums">
          {safe + 1}/{pages.length}
        </span>
      </span>
      <span className="insight-pager__controls">
        <button
          type="button"
          className="insight-pager__btn"
          aria-label={`Previous ${title.toLowerCase()}`}
          onClick={() => move(-1)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="insight-pager__btn"
          aria-label={`Next ${title.toLowerCase()}`}
          onClick={() => move(1)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </span>
    </div>
  )
}
