'use client'

/**
 * The community fold's figure, as beautifului's InsightCards
 * (`components/motion/insight-cards`, installed from
 * https://www.beautifului.dev/r/insight-cards.json), 2026-10-01.
 *
 * The same object the city, neighborhood and subdivision folds ship, bound to
 * this grain's reads in ./community-insight (the pure turn; read its header for
 * which supply page prints and why). The interaction is the catalog's: the
 * Insights pager (Previous insight / Next insight with the page count on its
 * face), one sentence per page, the two named supply bars with their hover,
 * and the closed-sales line with its pointer scrub and two metric chips.
 *
 * WITHHELD SUPPLY. When Market Truth keeps a community's months of supply under
 * its floor, page one says so with the count it rests on and draws that count
 * against the floor: one mark per closed sale, the floor's empty marks after
 * them. The parent city is offered in words and by the page's door, never as
 * bars under this community's heading. A figure a reader can check, never
 * this community's ratio.
 *
 * THE NUMERALS COUNT THROUGH THE REAL beUI number (`components/motion/number`),
 * passed both the live value and the caller's already-formatted face, so the
 * settled figure is the one the trace names and reduced motion lands on it
 * immediately (CLAUDE.md §0).
 *
 * THIS FILE FORMATS NOTHING.
 */

import { useMemo } from 'react'
import InsightCards, { AllocationCard, AnomalyCard, type InsightPage } from '@/components/motion/insight-cards'
import { AnimatedNumber } from '@/components/motion/number'
import { V3_ROOT_CLASS, V3MosBars, V3SourceLine, type V3MosBarsProps } from '@/components/site/v3'
import { nbhInsightCount, nbhInsightMoney } from '@/app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-insight'
import type {
  CommunityForSalePage,
  CommunityInsightBoard,
  CommunityInsightPath,
  CommunitySupplyFloor,
} from './community-insight'
import './community-insight.css'

export type CommunityInsightProps = {
  id: string
  placeName: string
  board: CommunityInsightBoard
  /** The community's own two bars, when its months of supply published. */
  mos: V3MosBarsProps | null
}

export function CommunityInsight({ id, placeName, board, mos }: CommunityInsightProps) {
  const pages = useMemo(() => buildPages(board, mos), [board, mos])
  if (pages.length === 0) return null

  return (
    <section id={id} className={`${V3_ROOT_CLASS} comm-insight`} aria-label={`${placeName}, page by page`}>
      <InsightCards pages={pages} labels={{ title: placeName }} />
    </section>
  )
}

function buildPages(board: CommunityInsightBoard, mos: V3MosBarsProps | null): InsightPage[] {
  const pages: InsightPage[] = []
  const supply = board.supply

  if (supply?.kind === 'published' && mos) {
    pages.push({
      key: 'supply',
      prose: <>{supply.prose}</>,
      Card: function SupplyCard() {
        return <V3MosBars {...mos} className="comm-insight__mos" />
      },
      pill: board.supplyHrefLabel,
      pillHref: board.supplyHref,
    })
  } else if (supply?.kind === 'floor') {
    pages.push({
      key: 'supply',
      prose: <FloorProse floor={supply} />,
      Card: function FloorCard() {
        return <FloorTally floor={supply} />
      },
      pill: board.supplyHrefLabel,
      pillHref: board.supplyHref,
    })
  }

  const forSale = board.forSale
  if (forSale) {
    pages.push({
      key: 'asking-prices',
      prose:
        forSale.medianValue != null && forSale.median ? (
          <>
            Half of the{' '}
            <AnimatedNumber
              value={forSale.count}
              duration={0.8}
              className="comm-insight__num"
              format={(n) => (Math.round(n) === forSale.count ? forSale.countLabel : nbhInsightCount(n))}
            />{' '}
            houses for sale ask more than{' '}
            <AnimatedNumber
              value={forSale.medianValue}
              duration={0.9}
              className="comm-insight__num"
              format={(n) =>
                Math.round(n) === Math.round(forSale.medianValue ?? 0) ? (forSale.median ?? '') : nbhInsightMoney(n)
              }
            />
            . Select a band to see how many sit in it.
          </>
        ) : (
          <>{forSale.note} Select a band to see how many sit in it.</>
        ),
      Card: function AskingPricesCard() {
        return <ForSaleCard page={forSale} />
      },
      pill: forSale.hrefLabel,
      pillHref: forSale.href,
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
            className="comm-insight__num"
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
        return <ClosedSalesChart path={path} />
      },
      pill: path.hrefLabel,
      pillHref: path.href,
    })
  }

  return pages
}

/** The count first, through the real beUI number; then the floor; then the parent place. */
function FloorProse({ floor }: { floor: CommunitySupplyFloor }) {
  const [, rest] = splitLeadCount(floor)
  return (
    <>
      {floor.closedSixMonths > 0 ? (
        <>
          <AnimatedNumber
            value={floor.closedSixMonths}
            duration={0.9}
            className="comm-insight__num"
            format={(n) => (Math.round(n) === floor.closedSixMonths ? floor.closedLabel : nbhInsightCount(n))}
          />
          {rest}
        </>
      ) : (
        floor.lead
      )}{' '}
      {floor.floorSentence}
      {floor.contextSentence ? <> {floor.contextSentence}</> : null}
    </>
  )
}

/** The lead's count and the words after it, so the numeral is printed once. */
function splitLeadCount(floor: CommunitySupplyFloor): [string, string] {
  const label = floor.closedLabel
  return floor.lead.startsWith(label) ? [label, floor.lead.slice(label.length)] : ['', floor.lead]
}

/**
 * One mark per closed sale, then the floor's empty marks: how far this
 * community is from a published read, drawn rather than said twice.
 */
function FloorTally({ floor }: { floor: CommunitySupplyFloor }) {
  const marks = Array.from({ length: floor.minN }, (_, i) => i < floor.closedSixMonths)
  return (
    <figure className="comm-insight__tally">
      <div
        className="comm-insight__tally-marks"
        role="img"
        aria-label={`${floor.closedLabel} of the ${floor.minN} closed sales a months-of-supply figure needs`}
      >
        {marks.map((filled, i) => (
          <span key={i} className={filled ? 'comm-insight__tally-mark is-filled' : 'comm-insight__tally-mark'} />
        ))}
      </div>
      <figcaption className="comm-insight__tally-caption">
        <span>{floor.closedLabel} sold in six months</span>
        <span>{floor.minN} needed for a read</span>
      </figcaption>
      <V3SourceLine source={floor.tallySource} sourceName="Oregon Data Share" />
    </figure>
  )
}

/**
 * The catalog's AllocationCard, whole: the segmented bar and the chips select a
 * band without moving the card, and the hero figure is that band's own count.
 */
function ForSaleCard({ page }: { page: CommunityForSalePage }) {
  return (
    <div className="comm-insight__chart">
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
      <V3SourceLine source={page.source} sourceName="Oregon Data Share" />
    </div>
  )
}

/** The catalog's AnomalyCard, whole: pointer-scrub line plus two metric chips. */
function ClosedSalesChart({ path }: { path: CommunityInsightPath }) {
  return (
    <div className="comm-insight__chart">
      <AnomalyCard
        data={{ spend: path.points.map((p) => p.median), usage: path.points.map((p) => p.sold) }}
        labels={{
          title: path.window,
          spend: 'Median sale price',
          usage: 'Homes sold',
          formatSpend: nbhInsightMoney,
          formatUsage: nbhInsightCount,
          spentLine: () => `Median sale price ran ${path.range.medianLow} to ${path.range.medianHigh};`,
          vsLine: `homes sold ran ${path.range.soldLow} to ${path.range.soldHigh}. ${path.window}.`,
        }}
        tickLabels={path.points.map((p) => p.label.slice(0, 3))}
      />
      <V3SourceLine source={path.source} sourceName="Oregon Data Share" />
    </div>
  )
}
