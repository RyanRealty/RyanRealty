'use client'

/**
 * Region fold InsightCards. Pointer-scrub on the house chart updates the
 * DigitSwap hero (beautifului-insight + beui-number). Animate toggles a
 * second sourced face, same as the beUI number preview.
 */

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { DigitSwapReplay } from '@/components/motion/digit-swap'
import { InsightCards } from '@/components/motion/insight-cards'
import { V3Chart, type V3ChartRead } from '@/components/site/v3/V3Chart'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import type { RegionInsightPage } from './region-figures'

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

function labelForRead(page: RegionInsightPage, read: V3ChartRead | null): string {
  if (!read) return page.figure
  const named = page.readName
    ? read.readings.find((row) => row.name === page.readName)
    : undefined
  const row = named ?? read.readings.find((item) => item.emphasis) ?? read.readings[0]
  return row?.label || page.figure
}

export function RegionInsightCards({ pages }: RegionInsightCardsProps) {
  const [page, setPage] = useState(0)
  const [read, setRead] = useState<V3ChartRead | null>(null)
  const onRead = useCallback((next: V3ChartRead | null) => {
    setRead((current) => (sameRead(current, next) ? current : next))
  }, [])

  if (pages.length < 2) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const current = pages[safe]
  if (!current) return null

  const figure = labelForRead(current, read)
  const figureLabel = read ? `${current.figureLabel} in ${read.tick}` : current.figureLabel
  const pill = current.pillHref ? (
    <Link href={current.pillHref} className="insight-cards__pill-link">
      {current.pill}
    </Link>
  ) : (
    <span>{current.pill}</span>
  )

  return (
    <InsightCards
      id="market-insights"
      className={V3_ROOT_CLASS}
      title="Insights"
      page={safe}
      pageCount={pages.length}
      onPage={(index) => {
        setRead(null)
        setPage(index)
      }}
      claim={current.claim}
      figure={
        <DigitSwapReplay
          value={figure}
          alternate={current.alternate}
          animationKey={`${current.key}-${figure}`}
          className="insight-cards__swap"
        />
      }
      figureLabel={figureLabel}
      visual={
        current.chart ? (
          <V3Chart {...current.chart} yearPages={false} onRead={onRead} />
        ) : undefined
      }
      pill={pill}
    />
  )
}
