'use client'

/**
 * Region fold InsightCards. Rest is Compare. year-open clicks the
 * in-card Anomaly tab (v3-chart__hover) — paged Insights
 * Compare / Anomaly / Allocation, not a house month scrubber.
 * Faces are DigitSwap 1ch glyph slots.
 */

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { DigitSwap } from '@/components/motion/digit-swap'
import { InsightCards } from '@/components/motion/insight-cards'
import { V3Chart, type V3ChartRead } from '@/components/site/v3/V3Chart'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import {
  insightFaceForRead,
  type RegionInsightKind,
  type RegionInsightPage,
  type RegionInsightSegment,
} from './region-figures'

const KIND_TITLE: Record<RegionInsightKind, string> = {
  compare: 'Compare',
  anomaly: 'Anomaly',
  allocation: 'Allocation',
}

export type RegionInsightCardsProps = {
  pages: readonly RegionInsightPage[]
}

function sameRead(left: V3ChartRead | null, right: V3ChartRead | null): boolean {
  if (left === right) return true
  if (!left || !right) return false
  if (left.tick !== right.tick || left.readings.length !== right.readings.length) return false
  return left.readings.every((row, index) => {
    const other = right.readings[index]
    return (
      Boolean(other) &&
      row.name === other.name &&
      row.label === other.label &&
      row.emphasis === other.emphasis
    )
  })
}

function SwapFace({
  value,
  label,
  swapKey,
}: {
  value: string
  label?: string
  swapKey: string
}) {
  return (
    <span className="insight-cards__swap">
      <DigitSwap
        value={value}
        animationKey={swapKey}
        className="insight-cards__swap-face"
      />
      {label ? <span className="insight-cards__hero-label">{label}</span> : null}
    </span>
  )
}

function AnomalyToggle({
  segments,
  selected,
  onSelect,
}: {
  segments: readonly RegionInsightSegment[]
  selected: number
  onSelect: (index: number) => void
}) {
  return (
    <div className="insight-cards__metrics" role="group" aria-label="Pace snapshot">
      {segments.map((item, index) => (
        <button
          key={item.key}
          type="button"
          className={cn(
            'insight-cards__metric',
            index === selected && 'insight-cards__metric--on',
          )}
          aria-pressed={index === selected}
          onClick={() => onSelect(index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function AllocationBar({
  segments,
  selected,
  onSelect,
}: {
  segments: readonly RegionInsightSegment[]
  selected: number
  onSelect: (index: number) => void
}) {
  const total = segments.reduce((sum, item) => sum + (item.weight ?? 0), 0)
  if (!(total > 0)) return null
  return (
    <div className="insight-cards__alloc" role="group" aria-label="Allocation segments">
      <div className="insight-cards__alloc-bar">
        {segments.map((item, index) => {
          const pct = ((item.weight ?? 0) / total) * 100
          return (
            <button
              key={item.key}
              type="button"
              className={cn(
                'insight-cards__alloc-seg',
                index === selected && 'insight-cards__alloc-seg--on',
              )}
              style={{ flexGrow: item.weight ?? 0, flexBasis: 0 }}
              aria-pressed={index === selected}
              aria-label={`${item.label}: ${pct.toFixed(1)} percent`}
              onClick={() => onSelect(index)}
            >
              <span className="sr-only">{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="insight-cards__alloc-legend">
        {segments.map((item, index) => {
          const pct = ((item.weight ?? 0) / total) * 100
          return (
            <button
              key={`${item.key}-legend`}
              type="button"
              className={cn(
                'insight-cards__alloc-key',
                index === selected && 'insight-cards__alloc-key--on',
              )}
              aria-pressed={index === selected}
              onClick={() => onSelect(index)}
            >
              {item.label} {pct.toFixed(0)}%
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function RegionInsightCards({ pages }: RegionInsightCardsProps) {
  const [page, setPage] = useState(0)
  const [read, setRead] = useState<V3ChartRead | null>(null)
  const [segment, setSegment] = useState(0)
  const onRead = useCallback((next: V3ChartRead | null) => {
    setRead((current) => (sameRead(current, next) ? current : next))
  }, [])

  if (pages.length < 2) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const current = pages[safe]
  if (!current) return null

  const face = insightFaceForRead(current, read)
  const segments = current.segments ?? []
  const safeSegment = Math.max(0, Math.min(Math.max(segments.length - 1, 0), segment))
  const chosen = current.kind === 'compare' ? undefined : segments[safeSegment]
  const heroValue = chosen?.figure ?? face.figure
  const heroLabel = chosen?.label ?? face.figureLabel
  const pill = current.pillHref ? (
    <Link href={current.pillHref} className="insight-cards__pill-link">
      {current.pill}
    </Link>
  ) : (
    <span>{current.pill}</span>
  )

  const visual = current.chart ? (
    <V3Chart {...current.chart} hover={false} yearPages={false} onRead={onRead} />
  ) : current.kind === 'allocation' && segments.length >= 2 ? (
    <AllocationBar segments={segments} selected={safeSegment} onSelect={setSegment} />
  ) : segments.length >= 2 ? (
    <AnomalyToggle segments={segments} selected={safeSegment} onSelect={setSegment} />
  ) : undefined

  return (
    <InsightCards
      id="market-insights"
      className={cn(V3_ROOT_CLASS, 'region-insights')}
      title="Insights"
      kind={current.kind}
      kinds={pages.map((item) => KIND_TITLE[item.kind])}
      page={safe}
      pageCount={pages.length}
      onPage={(index) => {
        setRead(null)
        setSegment(0)
        setPage(index)
      }}
      claim={face.claim}
      figure={
        <SwapFace
          value={heroValue}
          label={current.kind === 'compare' ? undefined : heroLabel}
          swapKey={`${current.key}-${heroValue}`}
        />
      }
      figureLabel={current.kind === 'compare' ? face.figureLabel : undefined}
      secondFigure={
        face.secondFigure ? (
          <SwapFace
            value={face.secondFigure}
            swapKey={`${current.key}-b-${face.secondFigure}`}
          />
        ) : undefined
      }
      secondLabel={face.secondLabel}
      visual={visual}
      pill={pill}
    />
  )
}
