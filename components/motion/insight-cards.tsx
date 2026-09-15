'use client'

/**
 * beautifului InsightCards — paged insights with distinct claims and a
 * scrub-ready visual. Navy/cream paint is the house wrapper.
 *
 * Source: https://www.beautifului.dev/r/insight-cards.json
 * Interaction kept: Insights N ‹ ›, claim, hero figure, card visual, pill.
 * Owns its own pager chrome. Not InsightPager (that is YEAR 2024 1/3).
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import './insight-cards.css'

export type InsightCardsProps = {
  title?: string
  page: number
  pageCount: number
  onPage: (index: number) => void
  claim: string
  figure?: ReactNode
  figureLabel?: string
  secondFigure?: ReactNode
  secondLabel?: string
  visual?: ReactNode
  pill?: ReactNode
  className?: string
  id?: string
}

export function InsightCards({
  title = 'Insights',
  page,
  pageCount,
  onPage,
  claim,
  figure,
  figureLabel,
  secondFigure,
  secondLabel,
  visual,
  pill,
  className,
  id,
}: InsightCardsProps) {
  if (pageCount < 2) return null
  const safe = Math.max(0, Math.min(pageCount - 1, page))
  const move = (direction: -1 | 1) => {
    onPage((safe + direction + pageCount) % pageCount)
  }

  return (
    <div id={id} className={cn('insight-cards', className)} data-insight-page={safe}>
      <div className="insight-cards__pager" role="group" aria-label={`${title} pages`}>
        <span className="insight-cards__pager-face">
          <span className="insight-cards__pager-title">{title}</span>
          <span className="insight-cards__pager-count tabular-nums">{pageCount}</span>
        </span>
        <span className="insight-cards__pager-controls">
          <button
            type="button"
            className="insight-cards__pager-btn"
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
            className="insight-cards__pager-btn"
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
      <p className="insight-cards__claim">{claim}</p>
      {figure ? (
        <div className="insight-cards__figures">
          <p className="insight-cards__hero">
            <span className="insight-cards__hero-value">{figure}</span>
            {figureLabel ? <span className="insight-cards__hero-label">{figureLabel}</span> : null}
          </p>
          {secondFigure ? (
            <p className="insight-cards__hero">
              <span className="insight-cards__hero-value">{secondFigure}</span>
              {secondLabel ? (
                <span className="insight-cards__hero-label">{secondLabel}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {visual ? <div className="insight-cards__visual">{visual}</div> : null}
      {pill ? <div className="insight-cards__pill">{pill}</div> : null}
    </div>
  )
}
