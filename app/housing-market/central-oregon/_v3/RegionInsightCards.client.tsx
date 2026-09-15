'use client'

/**
 * Region fold InsightCards. Three distinct cards (sale / compare / ask),
 * pointer-scrub on the house chart updates DigitSwap (beautifului-insight +
 * house-chart hover). Animate lives on the number, not on the plot.
 */

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { DigitSwapReplay } from '@/components/motion/digit-swap'
import { InsightCards } from '@/components/motion/insight-cards'
import { V3Chart, type V3ChartRead } from '@/components/site/v3/V3Chart'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { insightFaceForRead, type RegionInsightPage } from './region-figures'

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
  const chosen = segments[safeSegment]
  const heroValue = chosen?.figure ?? face.figure
  const heroLabel = chosen?.label ?? face.figureLabel
  const scrubbing = read != null
  const pill = current.pillHref ? (
    <Link href={current.pillHref} className="insight-cards__pill-link">
      {current.pill}
    </Link>
  ) : (
    <span>{current.pill}</span>
  )

  const allocation =
    segments.length >= 2 ? (
      <div className="insight-cards__segments" role="group" aria-label="Ask snapshot">
        {segments.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={cn(
              'insight-cards__segment',
              index === safeSegment && 'insight-cards__segment--on',
            )}
            aria-pressed={index === safeSegment}
            onClick={() => setSegment(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
    ) : undefined

  return (
    <InsightCards
      id="market-insights"
      className={V3_ROOT_CLASS}
      title="Insights"
      page={safe}
      pageCount={pages.length}
      onPage={(index) => {
        setRead(null)
        setSegment(0)
        setPage(index)
      }}
      claim={face.claim}
      figure={
        <DigitSwapReplay
          key={`${current.key}-${heroValue}`}
          value={heroValue}
          label={heroLabel}
          reveal={scrubbing}
          animationKey={`${current.key}-${heroValue}`}
          className="insight-cards__swap"
        />
      }
      secondFigure={
        face.secondFigure ? (
          <DigitSwapReplay
            key={`${current.key}-b-${face.secondFigure}`}
            value={face.secondFigure}
            label={face.secondLabel}
            reveal={scrubbing}
            animationKey={`${current.key}-b-${face.secondFigure}`}
            className="insight-cards__swap"
          />
        ) : undefined
      }
      visual={
        current.chart ? (
          <V3Chart {...current.chart} yearPages={false} onRead={onRead} />
        ) : (
          allocation
        )
      }
      pill={pill}
    />
  )
}
