'use client'

/**
 * SITE-93 — the city fold's figure, as beautifului's InsightCards
 * (`components/motion/insight-cards`, installed from
 * https://www.beautifului.dev/r/insight-cards.json).
 *
 * WHAT IT REPLACED. The fold's right column ran three plates of one shape:
 * months of supply, new listings, and the email ask, each an eyebrow over a
 * figure over a source line, all the same width and all the same density. The
 * evaluator named it twice — "the stacked-section page" and "cream box" — and
 * asked for "paged insights with a scrubber over live charts". This is that
 * object: the Insights pager (Previous / Next, the page count on the face), one
 * sentence of prose per page, and a card whose interaction is the demo's.
 *
 * TWO PAGES, BOTH SOURCED.
 *
 *   1. SUPPLY keeps the two named bars (V3MosBars, the house primitive the
 *      layout lock protects) and puts the verdict sentence back above them.
 *      The verdict is derived from the same months-of-supply figure the bars
 *      draw, so the pill, the sentence and the bars cannot disagree
 *      (scripts/check-market-formula.mjs). Its pill opens /months-of-supply,
 *      where the method is written out.
 *   2. CLOSED SALES draws the published monthly series on the catalog's own
 *      AnomalyCard — its two metric chips and its pointer-scrub intact — so a
 *      reader can move through eight months of median sale price and switch
 *      the same line to how many homes closed. The monthly sold count is not
 *      published anywhere else on this page. The same rows draw the year
 *      overlay further down; that answers seasonality, this answers the trend.
 *      Its pill opens the city's market report.
 *
 * WHY AnomalyCard AND NOT CompareCard. Both are this catalog's cards. Liveline
 * 0.0.7's MULTI-SERIES path renders "No data to display" for any series it is
 * given (reproduced 2026-09-15 on /invest, which ships CompareCard, and on a
 * throwaway 8-point series here), so a CompareCard in the fold would publish an
 * empty chart under a sourced sentence. AnomalyCard drives Liveline through the
 * single-series `data` prop, which draws. One metric at a time is also the
 * honest read: a dollar axis and a count axis do not share a scale.
 *
 * THE NUMERAL COUNTS THROUGH THE REAL beUI number (`components/motion/number`).
 * It is passed BOTH the live value and the caller's already-formatted face, so
 * the settled figure is the one the trace names and reduced motion lands on it
 * immediately (CLAUDE.md §0).
 *
 * THIS FILE FORMATS NOTHING. Every string arrives preformatted from
 * ./city-insight (the pure turn) or from the page's own publishers.
 */

import { useMemo } from 'react'
import InsightCards, { AnomalyCard, useChartEpoch, type InsightPage } from '@/components/motion/insight-cards'
import { AnimatedNumber } from '@/components/motion/number'
import { V3_ROOT_CLASS, V3MosBars, V3SourceLine, type V3MosBarsProps } from '@/components/site/v3'
import { cityInsightCount, cityInsightMoney, type CityInsightBoard } from './city-insight'
import './city-insight.css'

export type CityInsightProps = {
  id: string
  board: CityInsightBoard
  /** The two named bars. Omitted when leftover HUD could not publish months of supply. */
  mos: V3MosBarsProps | null
  /** The latest COMPLETE month's median close, preformatted, with its month name. */
  latestSale: { value: number; formatted: string; monthLabel: string } | null
}

export function CityInsight({ id, board, mos, latestSale }: CityInsightProps) {
  // The same epoch the catalog's card lays its points on, so the month under a
  // tick is the month that point came from.
  const epoch = useChartEpoch()
  const pages = useMemo(() => buildPages(board, mos, latestSale, epoch), [board, mos, latestSale, epoch])
  if (pages.length === 0) return null

  return (
    <section id={id} className={`${V3_ROOT_CLASS} city-insight`} aria-label="This market, page by page">
      <InsightCards pages={pages} labels={{ title: 'This market' }} />
    </section>
  )
}

function buildPages(
  board: CityInsightBoard,
  mos: V3MosBarsProps | null,
  latestSale: CityInsightProps['latestSale'],
  epoch: number,
): InsightPage[] {
  const pages: InsightPage[] = []

  if (mos) {
    pages.push({
      key: 'supply',
      prose: <>{board.supplyProse ?? mos.caption}</>,
      Card: function SupplyCard() {
        return <V3MosBars {...mos} className="city-insight__mos" />
      },
      pill: board.supplyHrefLabel,
      href: board.supplyHref,
    })
  }

  const path = board.path
  if (path && path.points.length > 1) {
    const medians = path.points.map((p) => p.median)
    const solds = path.points.map((p) => p.sold)
    const labels = path.points.map((p) => p.label)
    const lastLabel = labels[labels.length - 1]
    pages.push({
      key: 'closed-sales',
      prose: latestSale ? (
        <>
          Half the homes that closed in {latestSale.monthLabel} sold above{' '}
          <AnimatedNumber
            value={latestSale.value}
            duration={0.9}
            className="city-insight__num"
            format={(n) => (Math.round(n) === Math.round(latestSale.value) ? latestSale.formatted : cityInsightMoney(n))}
          />
          . Drag across the line for any month, or switch it to how many sold.
        </>
      ) : (
        <>Median sale price and homes sold, month by month. Drag across the line to read any month.</>
      ),
      Card: function ClosedSalesCard() {
        return (
          <div className="city-insight__chart">
            <AnomalyCard
              data={{ spend: medians, usage: solds }}
              labels={{
                title: path.window,
                spend: 'Median sale price',
                usage: 'Homes sold',
                formatSpend: cityInsightMoney,
                formatUsage: cityInsightCount,
                spentLine: (money) => `${money} in ${lastLabel},`,
                vsLine: `over ${path.window}.`,
              }}
              formatTime={(t) => monthFace(t, labels, epoch)}
            />
            <V3SourceLine source={path.source} sourceName="Oregon Data Share" />
          </div>
        )
      },
      pill: path.hrefLabel,
      href: path.href,
    })
  }

  return pages
}

/**
 * AnomalyCard lays its points seven apart, ending at the chart epoch
 * (makePoints(values, 7, epoch)). Map a tick back onto the month it came from,
 * so the axis under the line names real months instead of clock time.
 */
function monthFace(t: number, labels: string[], epoch: number): string {
  if (labels.length === 0) return ''
  const gap = 7
  const index = Math.round((t - (epoch - (labels.length - 1) * gap)) / gap)
  if (index < 0 || index > labels.length - 1) return ''
  const label = labels[index] ?? ''
  // "August 2026" is too wide for a tick; the axis says the month, the source
  // line and the note carry the year.
  return label.split(' ')[0] ?? label
}
