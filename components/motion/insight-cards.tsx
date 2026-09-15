'use client'

/**
 * beautifului InsightCards — official Insights card object.
 * Official Compare form: pager, prose outside the card, then Card
 * (series columns, Trend snapshot, Snapshot, 166px stage, ChartTooltip)
 * then pill. Claim never lives inside insight-cards__card.
 *
 * Source: https://www.beautifului.dev/r/insight-cards.json
 * Compare / Anomaly / Allocation pages. Chart stage is the official year
 * scrubber (pointer X → point index). Not house-chart hover. Not InsightPager
 * (that is YEAR 2024 1/3).
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
  /** Official Compare/Anomaly ChartTooltip — on the stage while scrubbing. */
  tip?: ReactNode
  pill?: ReactNode
  snapshot?: string
  /** Official Compare label over the stage. */
  trend?: string
  figureSub?: string
  secondSub?: string
  className?: string
  id?: string
  kind?: string
  /** Official Compare/Anomaly pointer-scrub on the 166px stage. */
  pointCount?: number
  onScrub?: (index: number | null) => void
  /** House-chart fill: long-view series owns the viewport. Official pointer-scrub stays on. */
  fill?: boolean
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
  tip,
  pill,
  snapshot = 'Snapshot',
  trend = 'Trend snapshot',
  figureSub,
  secondSub,
  className,
  id,
  kind,
  pointCount = 0,
  onScrub,
  fill = false,
}: InsightCardsProps) {
  if (pageCount < 2) return null
  const safe = Math.max(0, Math.min(pageCount - 1, page))
  const move = (direction: -1 | 1) => {
    onPage((safe + direction + pageCount) % pageCount)
  }
  const scrubFromClientX = (clientX: number, el: HTMLElement) => {
    if (!onScrub || pointCount < 2) return
    const rect = el.getBoundingClientRect()
    const width = rect.width || 1
    const progress = Math.max(0, Math.min(1, (clientX - rect.left) / width))
    onScrub(Math.round(progress * (pointCount - 1)))
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
      <p className="insight-cards__claim">{claim}</p>
      <div className="insight-cards__card">
        {figure ? (
          <div className="insight-cards__series">
            <p className="insight-cards__series-row">
              <span className="insight-cards__series-head">
                <span className="insight-cards__series-dot" aria-hidden="true" />
                {figureLabel ? (
                  <span className="insight-cards__series-name">{figureLabel}</span>
                ) : null}
              </span>
              <span className="insight-cards__series-value">{figure}</span>
              {figureSub ? <span className="insight-cards__series-sub">{figureSub}</span> : null}
            </p>
            {secondFigure ? (
              <p className="insight-cards__series-row insight-cards__series-row--2">
                <span className="insight-cards__series-head">
                  <span className="insight-cards__series-dot" aria-hidden="true" />
                  {secondLabel ? (
                    <span className="insight-cards__series-name">{secondLabel}</span>
                  ) : null}
                </span>
                <span className="insight-cards__series-value">{secondFigure}</span>
                {secondSub ? <span className="insight-cards__series-sub">{secondSub}</span> : null}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="insight-cards__snap">
          {trend ? <span className="insight-cards__trend">{trend}</span> : null}
          {snapshot ? <span className="insight-cards__snapshot">{snapshot}</span> : null}
        </div>
        {chrome}
        {stage ? (
          <div
            className={cn('insight-chart-stage', fill && 'insight-chart-stage--fill')}
            data-insight-scrub="year"
            onPointerDown={(event) => scrubFromClientX(event.clientX, event.currentTarget)}
            onPointerMove={(event) => scrubFromClientX(event.clientX, event.currentTarget)}
            onPointerLeave={() => onScrub?.(null)}
            onPointerCancel={() => onScrub?.(null)}
            onPointerUp={() => onScrub?.(null)}
            onMouseEnter={(event) => scrubFromClientX(event.clientX, event.currentTarget)}
            onMouseMove={(event) => scrubFromClientX(event.clientX, event.currentTarget)}
            onMouseLeave={() => onScrub?.(null)}
          >
            {stage}
            {tip}
          </div>
        ) : null}
        {visual}
      </div>
      {pill ? <div className="insight-cards__pill">{pill}</div> : null}
    </div>
  )
}
