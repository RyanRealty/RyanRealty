'use client'

/**
 * Region fold InsightCards. Pages are distinct claims with DigitSwap
 * figures; the visual is a house chart plus scrubber, or the live ask pair.
 */

import Link from 'next/link'
import { useState } from 'react'
import { DigitSwapReplay } from '@/components/motion/digit-swap'
import { InsightCards } from '@/components/motion/insight-cards'
import { V3Chart } from '@/components/site/v3/V3Chart'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import type { RegionInsightPage } from './region-figures'

export type RegionInsightCardsProps = {
  pages: readonly RegionInsightPage[]
}

export function RegionInsightCards({ pages }: RegionInsightCardsProps) {
  const [page, setPage] = useState(0)
  if (pages.length < 2) return null
  const safe = Math.max(0, Math.min(pages.length - 1, page))
  const current = pages[safe]
  if (!current) return null

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
      onPage={setPage}
      claim={current.claim}
      figure={
        <DigitSwapReplay
          value={current.figure}
          animationKey={current.key}
          className="insight-cards__swap"
        />
      }
      figureLabel={current.figureLabel}
      secondFigure={
        current.secondFigure ? (
          <DigitSwapReplay
            value={current.secondFigure}
            animationKey={`${current.key}-2`}
            className="insight-cards__swap"
          />
        ) : undefined
      }
      secondLabel={current.secondLabel}
      visual={
        current.chart ? (
          <V3Chart {...current.chart} yearPages={false} />
        ) : undefined
      }
      pill={pill}
    />
  )
}
