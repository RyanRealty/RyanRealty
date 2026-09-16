'use client'

/**
 * SITE-112 — the subdivision fold's figure, as beautifului's InsightCards
 * (`components/motion/insight-cards`, installed from
 * https://www.beautifului.dev/r/insight-cards.json).
 *
 * The same object the city fold ships (app/cities/[slug]/_v3/CityInsight.client.tsx),
 * bound to this grain's own reads: the class gets one paged fold figure, not a
 * second invention per route. What differs is what a subdivision may publish.
 * REGISTRY §4 withholds months of supply and every closed-price statistic here,
 * so page one is the counted active set's asking prices on the catalog's
 * AllocationCard and page two is the yearly closed COUNT on its AnomalyCard.
 *
 * THE INTERACTION IS THE CATALOG'S. Previous insight / Next insight with the
 * page count on the face; the allocation bar's segments and chips select a
 * band without moving the card; the anomaly line takes a pointer scrub and its
 * two metric chips switch the series under the same axis. Only the paint is
 * ours (./subdivision-insight.css, tokens only).
 *
 * THE NUMERALS COUNT THROUGH THE REAL beUI number (`components/motion/number`),
 * passed BOTH the live value and the caller's already-formatted face, so the
 * settled figure is the one the trace names and reduced motion lands on it
 * immediately (CLAUDE.md §0).
 *
 * THIS FILE FORMATS NOTHING. Every string arrives preformatted from
 * ./subdivision-insight (the pure turn).
 */

import { useMemo } from 'react'
import InsightCards, {
  AllocationCard,
  AnomalyCard,
  useChartEpoch,
  type InsightPage,
} from '@/components/motion/insight-cards'
import { AnimatedNumber } from '@/components/motion/number'
import { V3_ROOT_CLASS, V3SourceLine } from '@/components/site/v3'
import {
  platInsightCount,
  platInsightMoney,
  type PlatForSalePage,
  type PlatInsightBoard,
  type PlatSoldPage,
} from './subdivision-insight'
import './subdivision-insight.css'

export type SubdivisionInsightProps = {
  id: string
  placeName: string
  board: PlatInsightBoard
  /** Source name for the trace clause under each card. */
  sourceName: string
  /** When the inventory read answered, for the asking-price trace. */
  asOf: string | null
}

export function SubdivisionInsight({ id, placeName, board, sourceName, asOf }: SubdivisionInsightProps) {
  const epoch = useChartEpoch()
  const pages = useMemo(
    () => buildPages(board, placeName, sourceName, asOf, epoch),
    [board, placeName, sourceName, asOf, epoch],
  )
  if (pages.length === 0) return null

  return (
    <section id={id} className={`${V3_ROOT_CLASS} plat-insight`} aria-label={`${placeName}, page by page`}>
      <InsightCards pages={pages} labels={{ title: 'This subdivision' }} />
    </section>
  )
}

function buildPages(
  board: PlatInsightBoard,
  placeName: string,
  sourceName: string,
  asOf: string | null,
  epoch: number,
): InsightPage[] {
  const pages: InsightPage[] = []

  const forSale = board.forSale
  if (forSale) {
    pages.push({
      key: 'asking-prices',
      prose: (
        <>
          The middle asking price of the{' '}
          <AnimatedNumber
            value={forSale.priced}
            duration={0.8}
            className="plat-insight__num"
            format={(n) => platInsightCount(n)}
          />{' '}
          homes for sale in {placeName} is{' '}
          <AnimatedNumber
            value={forSale.medianValue}
            duration={0.9}
            className="plat-insight__num"
            format={(n) =>
              Math.round(n) === Math.round(forSale.medianValue) ? forSale.median : platInsightMoney(n)
            }
          />
          . Select a band to see how many sit in it.
        </>
      ),
      Card: function AskingPricesCard() {
        return <ForSaleCard page={forSale} sourceName={sourceName} asOf={asOf} />
      },
      pill: forSale.hrefLabel,
      href: forSale.href,
    })
  }

  const sold = board.sold
  if (sold) {
    pages.push({
      key: 'homes-sold',
      prose: (
        <>
          <AnimatedNumber
            value={sold.total}
            duration={0.9}
            className="plat-insight__num"
            format={(n) => (Math.round(n) === sold.total ? sold.totalFormatted : platInsightCount(n))}
          />{' '}
          homes sold in {placeName} between {sold.window}. Drag across the line for any year, or switch it
          to the running total.
        </>
      ),
      Card: function HomesSoldCard() {
        return <SoldCard page={sold} sourceName={sourceName} epoch={epoch} />
      },
      pill: sold.hrefLabel,
      href: sold.href,
    })
  }

  return pages
}

/**
 * The catalog's AllocationCard, whole: the segmented bar and the chips select a
 * band without moving the card, and the hero figure is that band's own count.
 * The selected band's state is the card's own — this wrapper only hands it the
 * bands and hangs the §0 trace under it.
 */
function ForSaleCard({
  page,
  sourceName,
  asOf,
}: {
  page: PlatForSalePage
  sourceName: string
  asOf: string | null
}) {
  return (
    <div className="plat-insight__card">
      <AllocationCard
        segments={page.bands.map((band) => ({
          name: band.label,
          label: band.label,
          pct: band.pct,
          amount: band.amount,
          cls: '',
          tone: '',
        }))}
        note={page.note}
      />
      <V3SourceLine source={page.source} sourceName={sourceName} asOf={asOf} />
    </div>
  )
}

/** The catalog's AnomalyCard, whole: pointer-scrub line plus two metric chips. */
function SoldCard({ page, sourceName, epoch }: { page: PlatSoldPage; sourceName: string; epoch: number }) {
  const labels = page.years.map(String)
  return (
    <div className="plat-insight__card plat-insight__chart">
      <AnomalyCard
        data={{ spend: page.counts, usage: page.running }}
        labels={{
          title: page.window,
          spend: 'Homes sold',
          usage: 'Running total',
          formatSpend: platInsightCount,
          formatUsage: platInsightCount,
          // The line, read without touching it: the quiet year and the busy
          // year, both of them one of the charted years (§0).
          spentLine: () => `Between ${page.range.low} and ${page.range.high} homes sold a year;`,
          vsLine: `${page.totalFormatted} in all, ${page.window}.`,
        }}
        formatTime={(t) => yearFace(t, labels, epoch)}
      />
      <V3SourceLine source={page.source} sourceName={sourceName} />
    </div>
  )
}

/**
 * AnomalyCard lays its points seven apart, ending at the chart epoch
 * (makePoints(values, 7, epoch)). Map a tick back onto the year it came from,
 * so the axis under the line names a real year instead of a clock time.
 *
 * A TICK OFF THE SERIES GETS NOTHING. The card opens a 49-wide window and a
 * place with five complete years fills 28 of it, so a third of the axis sits
 * before the first year this page can name. Those ticks resolve to a negative
 * index and print empty rather than borrowing the nearest year (CLAUDE.md 0).
 */
function yearFace(t: number, labels: string[], epoch: number): string {
  if (labels.length === 0) return ''
  const gap = 7
  const index = Math.round((t - (epoch - (labels.length - 1) * gap)) / gap)
  if (index < 0 || index > labels.length - 1) return ''
  return labels[index] ?? ''
}
