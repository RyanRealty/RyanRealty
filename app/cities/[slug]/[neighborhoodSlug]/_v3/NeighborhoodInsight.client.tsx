'use client'

/**
 * SITE-104 — the neighborhood fold's figure, as beautifului's InsightCards
 * (`components/motion/insight-cards`, installed from
 * https://www.beautifului.dev/r/insight-cards.json).
 *
 * The same object the city fold ships (app/cities/[slug]/_v3/CityInsight.client.tsx)
 * and the subdivision fold ships (app/subdivisions/[slug]/_v3/SubdivisionInsight.client.tsx),
 * bound to this grain's own reads. TASTE.md: design the CLASS, not the instance.
 *
 * WHAT IT REPLACED. The months-of-supply bars used to float on the photograph
 * as a cream overlay whose claim sentence was clipped off the top at 1440 and
 * whose card covered the hillside at 375, and the rest of the fold was one
 * alerts sentence beside an email field. Nothing to page, nothing to scrub, no
 * drawing. This is the catalog object whole: the Insights pager (Previous
 * insight / Next insight with the page count on its face), one sentence of
 * prose per page, and a card whose interaction is the demo's.
 *
 * TWO PAGES, BOTH SOURCED.
 *
 *   1. SUPPLY keeps the two named bars (V3MosBars, the house primitive the
 *      layout lock protects) and puts the VERDICT above them — the word this
 *      fold has never published, computed by marketVerdict() off the same
 *      months-of-supply figure the bars draw, so the sentence, the pill and the
 *      bars cannot disagree (scripts/check-market-formula.mjs). The thresholds
 *      it was judged against are already printed in the MOS source line under
 *      the bars, so the verdict and its rule stay one tap apart without being
 *      said twice. Its pill opens /months-of-supply.
 *   2. CLOSED SALES draws this neighborhood's own published monthly series on
 *      the catalog's AnomalyCard — its two metric chips and its pointer-scrub
 *      intact — so a reader can move through the published months of median
 *      sale price and switch the same line to how many homes closed. The
 *      monthly sold count is published nowhere else on this page. The page
 *      passes no rows at all when the monthly read fell back to the parent
 *      city, because a city line under a neighborhood heading is a §0 lie.
 *      Its pill opens the parent city's market report.
 *
 * WHY AnomalyCard AND NOT CompareCard. Both are this catalog's cards. Liveline
 * 0.0.7's MULTI-SERIES path renders "No data to display" for any series it is
 * given (reproduced 2026-09-15 on /invest, which ships CompareCard), so a
 * CompareCard in the fold would publish an empty chart under a sourced
 * sentence. AnomalyCard drives Liveline through the single-series `data` prop,
 * which draws. One metric at a time is also the honest read: a dollar axis and
 * a count axis do not share a scale.
 *
 * THE NUMERAL COUNTS THROUGH THE REAL beUI number (`components/motion/number`).
 * It is passed BOTH the live value and the caller's already-formatted face, so
 * the settled figure is the one the trace names and reduced motion lands on it
 * immediately (CLAUDE.md §0).
 *
 * THIS FILE FORMATS NOTHING. Every string arrives preformatted from
 * ./neighborhood-insight (the pure turn) or from the page's own publishers.
 */

import { useMemo } from 'react'
import InsightCards, { AnomalyCard, useChartEpoch, type InsightPage } from '@/components/motion/insight-cards'
import { AnimatedNumber } from '@/components/motion/number'
import { V3_ROOT_CLASS, V3MosBars, V3SourceLine, type V3MosBarsProps } from '@/components/site/v3'
import {
  nbhInsightCount,
  nbhInsightMoney,
  type NeighborhoodInsightBoard,
  type NeighborhoodInsightPath,
} from './neighborhood-insight'
import './neighborhood-insight.css'

export type NeighborhoodInsightProps = {
  id: string
  placeName: string
  board: NeighborhoodInsightBoard
  /** The two named bars. Omitted when leftover HUD could not publish months of supply. */
  mos: V3MosBarsProps | null
}

export function NeighborhoodInsight({ id, placeName, board, mos }: NeighborhoodInsightProps) {
  // The same epoch the catalog's card lays its points on, so the month under a
  // tick is the month that point came from.
  const epoch = useChartEpoch()
  const pages = useMemo(() => buildPages(board, mos, epoch), [board, mos, epoch])
  if (pages.length === 0) return null

  return (
    <section id={id} className={`${V3_ROOT_CLASS} nbh-insight`} aria-label={`${placeName}, page by page`}>
      <InsightCards pages={pages} labels={{ title: 'This neighborhood' }} />
    </section>
  )
}

function buildPages(
  board: NeighborhoodInsightBoard,
  mos: V3MosBarsProps | null,
  epoch: number,
): InsightPage[] {
  const pages: InsightPage[] = []

  if (mos) {
    pages.push({
      key: 'supply',
      prose: <>{board.supplyProse ?? mos.caption}</>,
      Card: function SupplyCard() {
        return <V3MosBars {...mos} className="nbh-insight__mos" />
      },
      pill: board.supplyHrefLabel,
      href: board.supplyHref,
    })
  }

  const path = board.path
  if (path && path.points.length > 1) {
    pages.push({
      key: 'closed-sales',
      prose: (
        <>
          Half the homes that closed in {path.latest.label} sold above{' '}
          <AnimatedNumber
            value={path.latest.median}
            duration={0.9}
            className="nbh-insight__num"
            format={(n) =>
              Math.round(n) === Math.round(path.latest.median)
                ? path.latest.medianFormatted
                : nbhInsightMoney(n)
            }
          />
          . Drag across the line for any month, or switch it to how many sold.
        </>
      ),
      Card: function ClosedSalesCard() {
        return <ClosedSalesChart path={path} epoch={epoch} />
      },
      pill: path.hrefLabel,
      href: path.href,
    })
  }

  return pages
}

/** The catalog's AnomalyCard, whole: pointer-scrub line plus two metric chips. */
function ClosedSalesChart({ path, epoch }: { path: NeighborhoodInsightPath; epoch: number }) {
  const labels = path.points.map((p) => p.label)
  return (
    <div className="nbh-insight__chart">
      <AnomalyCard
        data={{ spend: path.points.map((p) => p.median), usage: path.points.map((p) => p.sold) }}
        labels={{
          title: path.window,
          spend: 'Median sale price',
          usage: 'Homes sold',
          formatSpend: nbhInsightMoney,
          formatUsage: nbhInsightCount,
          // The line, read without touching it: both metrics as a range over
          // the months it draws. Every figure here is one of those published
          // months (§0).
          spentLine: () => `Median sale price ran ${path.range.medianLow} to ${path.range.medianHigh};`,
          vsLine: `homes sold ran ${path.range.soldLow} to ${path.range.soldHigh}. ${path.window}.`,
        }}
        formatTime={(t) => monthFace(t, labels, epoch)}
      />
      <V3SourceLine source={path.source} sourceName="Oregon Data Share" />
    </div>
  )
}

/**
 * AnomalyCard lays its points seven apart, ending at the chart epoch
 * (makePoints(values, 7, epoch)). Map a tick back onto the month it came from,
 * so the axis under the line names a real month instead of clock time.
 *
 * A TICK OFF THE SERIES GETS NOTHING. The card opens a 49-wide window and eight
 * points fill 49 of it exactly, but a shorter series leaves ticks before the
 * first month this page can name. Those resolve to a negative index and print
 * empty rather than borrowing the nearest month (CLAUDE.md §0).
 */
function monthFace(t: number, labels: string[], epoch: number): string {
  if (labels.length === 0) return ''
  const gap = 7
  const index = Math.round((t - (epoch - (labels.length - 1) * gap)) / gap)
  if (index < 0 || index > labels.length - 1) return ''
  const label = labels[index] ?? ''
  // "August 2026" is too wide for a tick; the axis says the month, the source
  // line and the card's own title carry the window.
  return label.split(' ')[0] ?? label
}
