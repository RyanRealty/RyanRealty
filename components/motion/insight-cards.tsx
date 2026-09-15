'use client'

/**
 * beautifului InsightCards — paged insights with distinct claims and a
 * scrub-ready visual. Navy/cream paint is the house wrapper.
 *
 * Source: https://www.beautifului.dev/r/insight-cards.json
 * Interaction kept: Insights N ‹ ›, claim, hero figure, card visual, pill.
 * Not a year switcher of one series.
 */

import type { ReactNode } from 'react'
import { InsightPager } from '@/components/motion/insight-pager'
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
  const labels = Array.from({ length: pageCount }, (_, i) => String(i + 1))

  return (
    <div id={id} className={cn('insight-cards', className)} data-insight-page={page}>
      <InsightPager
        title={title}
        pages={labels}
        page={page}
        onPage={onPage}
        showCurrent={false}
      />
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
