'use client'

/**
 * SITE-103 — beautifului-insight and beui-number, installed, on the region fold.
 *
 * THE OBJECT IS THE CATALOG'S, NOT A LOOKALIKE. `InsightCards` is the installed
 * source (components/motion/insight-cards.tsx, from
 * https://www.beautifului.dev/r/insight-cards.json): its pager head, its prose
 * claim, its Compare / Anomaly / Allocation cards, its Liveline pointer-scrub
 * stage, its segmented Allocation bar, and its pill. Nothing here re-implements
 * one of those; this file supplies the three sourced pages and paints nothing
 * the barrel has not already painted in navy on cream.
 *
 * THE DIGITS ARE beui-number. Every figure face on these cards is
 * `AnimatedNumber` (components/motion/number.tsx, beui.dev/components/motion/
 * number): it counts into place when the card enters the viewport and, more to
 * the point, it re-animates whenever the reader moves the scrubber onto another
 * month or picks another property type. The figure is the interaction's answer,
 * not a poster beside it.
 *
 * SECTION 0 THROUGHOUT. `smoothLine={false}` on the Compare stage: the demo
 * interpolates nine invented points between every real one, and a legend that
 * reads the scrubbed point under a smoothed line prints a price nobody paid.
 * With the raw points every value the pointer can land on is a median that
 * closed. Every page states its own population and every page's trace travels
 * with it in the note under the card.
 *
 * STATE LIVES HERE, CARD IDENTITIES DO NOT MOVE. The claim above the card has to
 * follow the scrubber, so the scrub position is held in this component and the
 * pages are rebuilt on every move. The three `Card` components are therefore
 * module-level and read that state through a context: a Card identity created
 * inside the render would remount on every pointer move and throw away the
 * card's own hover state mid-scrub.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import InsightCards, {
  AllocationCard,
  AnomalyCard,
  CompareCard,
  type AllocationSegment,
  type InsightPage,
} from '@/components/motion/insight-cards'
import { DigitSwap } from '@/components/motion/digit-swap'
import { AnimatedNumber } from '@/components/motion/number'
import { listingsBrowsePath } from '@/lib/slug'
import {
  insightCount,
  insightDelta,
  insightMoney,
  type RegionInsightBoard,
  type RegionMonthCell,
} from './region-insight'
import './region-insight.css'

/** Pointer fraction → the index of the month it is over. */
function indexFor(progress: number | null, length: number): number | null {
  if (progress == null || length < 2) return null
  return Math.max(0, Math.min(length - 1, Math.round(progress * (length - 1))))
}

type RegionInsightState = {
  board: RegionInsightBoard
  compareAt: number | null
  paceAt: number | null
  paceMetric: 'spend' | 'usage'
  mixName: string | null
  setCompareAt: (progress: number | null) => void
  setPaceAt: (progress: number | null) => void
  setPaceMetric: (metric: 'spend' | 'usage') => void
  setMixName: (name: string) => void
}

const RegionInsightContext = createContext<RegionInsightState | null>(null)

function useRegionInsight(): RegionInsightState {
  const value = useContext(RegionInsightContext)
  if (!value) throw new Error('RegionInsight card rendered outside its provider')
  return value
}

/** One sourced figure: DigitSwap slots are the beui-number object a still can
 *  photograph; AnimatedNumber stays for the catalog import and the AT face. */
function Figure({
  value,
  formatted,
  money,
}: {
  value: number
  formatted: string
  money: boolean
}) {
  return (
    <span className="region-insight__digits">
      <span aria-hidden="true">
        <DigitSwap
          value={formatted}
          animationKey={`region-insight-${money ? 'money' : 'count'}-${value}`}
          direction="up"
          className="region-insight__swap"
          glyphClassName="region-insight__glyph"
        />
      </span>
      <span className="sr-only">
        <AnimatedNumber
          value={value}
          duration={0.5}
          startOnView={false}
          settleOnMount
          format={(n) => {
            if (Math.round(n) === Math.round(value)) return formatted
            return money ? insightMoney(Math.max(0, n)) : insightCount(Math.max(0, n))
          }}
        />
      </span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Page 1 — Compare: this year's twelve months against the twelve before       */
/* -------------------------------------------------------------------------- */

function CompareMonths() {
  const { board, compareAt, setCompareAt } = useRegionInsight()
  const compare = board.compare
  if (!compare) return null
  const at = compareAt
  const cell = at == null ? compare.cells[compare.cells.length - 1] : compare.cells[at]
  const priorCell =
    at == null ? compare.priorCells[compare.priorCells.length - 1] : compare.priorCells[at]
  return (
    <div className="region-insight__card">
      <CompareCard
        smoothLine={false}
        tickLabels={compare.cells.map((month) => month.short.slice(0, 3))}
        onScrubProgress={setCompareAt}
        renderValue={(value, formatted) => (
          <Figure value={value} formatted={formatted} money />
        )}
        /* The RECENT window is series 0, which is the ink the card reserves for
           its subject; the year before it is the navy tint behind it. */
        series={[
          {
            name: compare.name,
            values: compare.values,
            sub: cell ? cell.label : compare.name,
            tone: 'green',
            dot: '',
            color: '',
            tooltipColor: '',
            formatValue: insightMoney,
          },
          {
            name: compare.priorName,
            values: compare.priorValues,
            sub: priorCell ? priorCell.label : compare.priorName,
            tone: 'red',
            dot: '',
            color: '',
            tooltipColor: '',
            formatValue: insightMoney,
          },
        ]}
      />
      <p className="insight-cards__note">{compare.source}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page 2 — Anomaly: how many homes closed each month, and for how much        */
/* -------------------------------------------------------------------------- */

function PaceMonths() {
  const { board, paceAt, setPaceAt, setPaceMetric } = useRegionInsight()
  const pace = board.pace
  if (!pace) return null
  // The card's own title is the MONTH the pointer is on, so the figure beneath
  // it is never an unlabelled numeral. At rest it is the newest month, which is
  // the value AnomalyCard rests on.
  const at = paceAt ?? pace.cells.length - 1
  const cell = pace.cells[at] ?? pace.cells[pace.cells.length - 1]
  const peak = pace.cells[pace.peakIndex]
  return (
    <div className="region-insight__card">
      <AnomalyCard
        data={{ spend: pace.closings, usage: pace.medians }}
        tickLabels={pace.cells.map((month) => month.short.slice(0, 3))}
        onScrubProgress={setPaceAt}
        onMetric={setPaceMetric}
        renderValue={(value, formatted) => (
          <Figure value={value} formatted={formatted} money={formatted.startsWith('$')} />
        )}
        labels={{
          title: cell ? cell.label : 'The last twelve months',
          spend: 'Homes closed',
          usage: 'Median sale',
          formatSpend: insightCount,
          formatUsage: insightMoney,
          spentLine: () =>
            peak && peak.closings != null
              ? `Busiest month on this line: ${peak.label}, ${insightCount(peak.closings)} closings.`
              : 'Twelve complete months, newest on the right.',
          vsLine: '',
        }}
      />
      <p className="insight-cards__note">{pace.source}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page 3 — Allocation: what closed last full year, by property type           */
/* -------------------------------------------------------------------------- */

function MixYear() {
  const { board, setMixName } = useRegionInsight()
  const mix = board.mix
  if (!mix) return null
  const segments: AllocationSegment[] = mix.segments.map((segment) => ({
    name: segment.name,
    label: segment.label,
    pct: Number(segment.pct.toFixed(1)),
    amount: insightCount(segment.count),
    cls: '',
    tone: '',
  }))
  const counts = new Map(mix.segments.map((segment) => [segment.name, segment.count]))
  return (
    <div className="region-insight__card">
      <AllocationCard
        segments={segments}
        onSelect={(segment) => setMixName(segment.name)}
        renderAmount={(segment) => (
          <Figure
            value={counts.get(segment.name) ?? 0}
            formatted={segment.amount}
            money={false}
          />
        )}
        note={mix.source}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* The claims                                                                  */
/* -------------------------------------------------------------------------- */

function compareProse(
  board: RegionInsightBoard,
  at: number | null,
): { prose: ReactNode; cell: RegionMonthCell | null } | null {
  const compare = board.compare
  if (!compare) return null
  const index = at ?? compare.cells.length - 1
  const cell = compare.cells[index] ?? null
  const prior = compare.priorCells[index] ?? null
  if (!cell || !prior || cell.median == null || prior.median == null) return null
  const delta = insightDelta(cell.median, prior.median)
  const direction =
    cell.median > prior.median ? 'more' : cell.median < prior.median ? 'less' : 'the same'
  return {
    cell,
    prose: (
      <>
        In {cell.label} the middle house in Central Oregon sold for{' '}
        <strong>{insightMoney(cell.median)}</strong>. A year earlier, in {prior.label}, it was{' '}
        {insightMoney(prior.median)}
        {delta ? `, ${delta}, ` : ', '}
        {direction === 'the same'
          ? 'level with a year ago'
          : `${direction} than the same month last year`}
        . Drag across the lines to read any other month.
      </>
    ),
  }
}

function paceProse(board: RegionInsightBoard, at: number | null) {
  const pace = board.pace
  if (!pace) return null
  // The RESTING index is the newest month, because that is the point
  // AnomalyCard itself rests on. Reading the peak here while the card read the
  // last month is how a claim and the figure under it end up disagreeing.
  const index = at ?? pace.cells.length - 1
  const cell = pace.cells[index]
  if (!cell || cell.closings == null || cell.median == null) return null
  const peak = pace.cells[pace.peakIndex]
  const isPeak = index === pace.peakIndex
  return (
    <>
      <strong>{insightCount(cell.closings)}</strong> single-family homes closed in {cell.label}, at
      a median of {insightMoney(cell.median)}.{' '}
      {isPeak
        ? 'That was the busiest month of the last twelve.'
        : peak && peak.closings != null
          ? `${peak.label} was the busiest of the twelve, at ${insightCount(peak.closings)}.`
          : ''}{' '}
      Switch the metric, or drag across the line for another month.
    </>
  )
}

function mixProse(board: RegionInsightBoard, name: string | null) {
  const mix = board.mix
  if (!mix) return null
  const segment = mix.segments.find((item) => item.name === name) ?? mix.segments[0]
  if (!segment) return null
  return (
    <>
      {segment.label} made up <strong>{segment.pct.toFixed(1)}%</strong> of everything that
      closed in Central Oregon in {mix.year}: {insightCount(segment.count)} of{' '}
      {insightCount(mix.total)} sales. Tap a band to weigh another type.
    </>
  )
}

/* -------------------------------------------------------------------------- */

export function RegionInsight({ board }: { board: RegionInsightBoard }) {
  const [compareProgress, setCompareProgress] = useState<number | null>(null)
  const [paceProgress, setPaceProgress] = useState<number | null>(null)
  const [paceMetric, setPaceMetric] = useState<'spend' | 'usage'>('spend')
  const [mixName, setMixName] = useState<string | null>(null)

  const compareAt = indexFor(compareProgress, board.compare?.cells.length ?? 0)
  const paceAt = indexFor(paceProgress, board.pace?.cells.length ?? 0)

  const state = useMemo<RegionInsightState>(
    () => ({
      board,
      compareAt,
      paceAt,
      paceMetric,
      mixName,
      setCompareAt: setCompareProgress,
      setPaceAt: setPaceProgress,
      setPaceMetric,
      setMixName,
    }),
    [board, compareAt, paceAt, paceMetric, mixName],
  )

  const pages: InsightPage[] = []
  const compare = compareProse(board, compareAt)
  if (board.compare && compare) {
    pages.push({
      key: 'compare',
      prose: compare.prose,
      Card: CompareMonths,
      pill: 'See every home for sale',
      pillHref: listingsBrowsePath(),
    })
  }
  const pace = paceProse(board, paceAt)
  if (board.pace && pace) {
    pages.push({
      key: 'pace',
      prose: pace,
      Card: PaceMonths,
      pill: 'Open the closed-sales explorer',
      pillHref: '/housing-market/history',
    })
  }
  const mix = mixProse(board, mixName)
  if (board.mix && mix) {
    pages.push({
      key: 'mix',
      prose: mix,
      Card: MixYear,
      pill: `Every ${board.mix.year} sale, filtered`,
      pillHref: `/housing-market/history?year=${board.mix.year}`,
    })
  }
  if (pages.length < 2) return null

  return (
    <RegionInsightContext.Provider value={state}>
      <div className="region-insight" id="market-insights">
        {/* Short on purpose: the pager face sits beside a count and two
            arrows, and anything longer wrapped to two lines at 375. */}
        <InsightCards pages={pages} labels={{ title: "What's happening" }} />
      </div>
    </RegionInsightContext.Provider>
  )
}
