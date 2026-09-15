'use client'

/**
 * beautifului InsightCards — official Insights card object.
 * Pager + prose + card (series rows, Snapshot, insight-chart-stage) + pill.
 *
 * Source: https://www.beautifului.dev/r/insight-cards.json
 * Compare / Anomaly / Allocation pages. Chart stage is pointer-scrub, not a
 * house figure caption. Not InsightPager (that is YEAR 2024 1/3).
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
  /** Official Anomaly Spend/Usage-style chrome — outside the chart stage. */
  chrome?: ReactNode
  /** Pointer-scrub chart. Wrapped in official insight-chart-stage. */
  stage?: ReactNode
  pill?: ReactNode
  snapshot?: string
  className?: string
  id?: string
  kind?: string
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
  chrome,
  stage,
  pill,
  snapshot = 'Snapshot',
  className,
  id,
  kind,
}: InsightCardsProps) {
  if (pageCount < 2) return null
  const safe = Math.max(0, Math.min(pageCount - 1, page))
  const move = (direction: -1 | 1) => {
    onPage((safe + direction + pageCount) % pageCount)
  }

  return (
    <div
      id={id}
      className={cn('insight-cards', className)}
      data-insight-page={safe}
      data-insight-kind={kind}
    >
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
            data-insight-next=""
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
      <div className="insight-cards__card">
        <p className="insight-cards__claim">{claim}</p>
        <div className="insight-cards__card-head">
          {figure ? (
            <div className="insight-cards__series">
              <p className="insight-cards__series-row">
                {figureLabel ? (
                  <span className="insight-cards__series-name">{figureLabel}</span>
                ) : null}
                <span className="insight-cards__series-value">{figure}</span>
              </p>
              {secondFigure ? (
                <p className="insight-cards__series-row">
                  {secondLabel ? (
                    <span className="insight-cards__series-name">{secondLabel}</span>
                  ) : null}
                  <span className="insight-cards__series-value">{secondFigure}</span>
                </p>
              ) : null}
            </div>
          ) : null}
          {snapshot ? <span className="insight-cards__snapshot">{snapshot}</span> : null}
        </div>
        {chrome}
        {stage ? <div className="insight-chart-stage">{stage}</div> : null}
        {visual}
        {pill ? <div className="insight-cards__pill">{pill}</div> : null}
      </div>
    </div>
  )
}
