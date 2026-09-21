'use client'

/**
 * SITE-102 — beautifului-insight and beui-number, installed, on the city fold.
 *
 * THE OBJECT IS THE CATALOG'S. InsightCards is the installed source
 * (`components/motion/insight-cards.tsx`); AnimatedNumber is the installed
 * beUI number (`components/motion/number.tsx`). Tip Ready requires those
 * specifiers in this route's `_v3` set. DigitSwap slots are the still-visible
 * beui-number face. Navy/cream paint only. Visitor English only.
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
import { homesForSalePath } from '@/lib/slug'
import {
  insightCount,
  insightDelta,
  insightMoney,
  type RegionInsightBoard,
  type RegionMonthCell,
} from './city-insight'
import './city-insight.css'

function indexFor(progress: number | null, length: number): number | null {
  if (progress == null || length < 2) return null
  return Math.max(0, Math.min(length - 1, Math.round(progress * (length - 1))))
}

type CityInsightState = {
  board: RegionInsightBoard
  cityName: string
  compareAt: number | null
  paceAt: number | null
  paceMetric: 'spend' | 'usage'
  mixName: string | null
  setCompareAt: (progress: number | null) => void
  setPaceAt: (progress: number | null) => void
  setPaceMetric: (metric: 'spend' | 'usage') => void
  setMixName: (name: string) => void
}

const CityInsightContext = createContext<CityInsightState | null>(null)

function useCityInsight(): CityInsightState {
  const value = useContext(CityInsightContext)
  if (!value) throw new Error('CityInsight card rendered outside its provider')
  return value
}

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
    <span className="city-insight__digits">
      <span aria-hidden="true">
        <DigitSwap
          value={formatted}
          animationKey={`city-insight-${money ? 'money' : 'count'}-${value}`}
          direction="up"
          className="city-insight__swap"
          glyphClassName="city-insight__glyph"
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

function CompareMonths() {
  const { board, compareAt, setCompareAt } = useCityInsight()
  const compare = board.compare
  if (!compare) return null
  const at = compareAt
  const cell = at == null ? compare.cells[compare.cells.length - 1] : compare.cells[at]
  const priorCell =
    at == null ? compare.priorCells[compare.priorCells.length - 1] : compare.priorCells[at]
  return (
    <div className="city-insight__card">
      <CompareCard
        smoothLine={false}
        tickLabels={compare.cells.map((month) => month.short.slice(0, 3))}
        onScrubProgress={setCompareAt}
        renderValue={(value, formatted) => <Figure value={value} formatted={formatted} money />}
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

function PaceMonths() {
  const { board, paceAt, setPaceAt, setPaceMetric } = useCityInsight()
  const pace = board.pace
  if (!pace) return null
  const at = paceAt ?? pace.cells.length - 1
  const cell = pace.cells[at] ?? pace.cells[pace.cells.length - 1]
  const peak = pace.cells[pace.peakIndex]
  return (
    <div className="city-insight__card">
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

function MixYear() {
  const { board, setMixName } = useCityInsight()
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
    <div className="city-insight__card">
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

function compareProse(
  cityName: string,
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
        In {cell.label} the middle house in {cityName} sold for{' '}
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

function paceProse(cityName: string, board: RegionInsightBoard, at: number | null) {
  const pace = board.pace
  if (!pace) return null
  const index = at ?? pace.cells.length - 1
  const cell = pace.cells[index]
  if (!cell || cell.closings == null || cell.median == null) return null
  const peak = pace.cells[pace.peakIndex]
  const isPeak = index === pace.peakIndex
  return (
    <>
      <strong>{insightCount(cell.closings)}</strong> single-family homes closed in {cityName} in{' '}
      {cell.label}, at a median of {insightMoney(cell.median)}.{' '}
      {isPeak
        ? 'That was the busiest month of the last twelve.'
        : peak && peak.closings != null
          ? `${peak.label} was the busiest of the twelve, at ${insightCount(peak.closings)}.`
          : ''}{' '}
      Switch the metric, or drag across the line for another month.
    </>
  )
}

function mixProse(cityName: string, board: RegionInsightBoard, name: string | null) {
  const mix = board.mix
  if (!mix) return null
  const segment = mix.segments.find((item) => item.name === name) ?? mix.segments[0]
  if (!segment) return null
  return (
    <>
      {segment.label} made up <strong>{segment.pct.toFixed(1)}%</strong> of everything that closed
      in {cityName} in {mix.year}: {insightCount(segment.count)} of {insightCount(mix.total)}{' '}
      sales. Tap a band to weigh another type.
    </>
  )
}

export function CityInsight({
  board,
  cityName,
}: {
  board: RegionInsightBoard
  cityName: string
}) {
  const [compareProgress, setCompareProgress] = useState<number | null>(null)
  const [paceProgress, setPaceProgress] = useState<number | null>(null)
  const [paceMetric, setPaceMetric] = useState<'spend' | 'usage'>('spend')
  const [mixName, setMixName] = useState<string | null>(null)

  const compareAt = indexFor(compareProgress, board.compare?.cells.length ?? 0)
  const paceAt = indexFor(paceProgress, board.pace?.cells.length ?? 0)

  const state = useMemo<CityInsightState>(
    () => ({
      board,
      cityName,
      compareAt,
      paceAt,
      paceMetric,
      mixName,
      setCompareAt: setCompareProgress,
      setPaceAt: setPaceProgress,
      setPaceMetric,
      setMixName,
    }),
    [board, cityName, compareAt, paceAt, paceMetric, mixName],
  )

  const pages: InsightPage[] = []
  const compare = compareProse(cityName, board, compareAt)
  if (board.compare && compare) {
    pages.push({
      key: 'compare',
      prose: compare.prose,
      Card: CompareMonths,
      pill: `See ${cityName} homes for sale`,
      pillHref: homesForSalePath(cityName),
    })
  }
  const pace = paceProse(cityName, board, paceAt)
  if (board.pace && pace) {
    pages.push({
      key: 'pace',
      prose: pace,
      Card: PaceMonths,
      pill: 'Open the closed-sales explorer',
      pillHref: '/housing-market/history',
    })
  }
  const mix = mixProse(cityName, board, mixName)
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
    <CityInsightContext.Provider value={state}>
      <div className="city-insight" id="market-insights">
        <InsightCards pages={pages} labels={{ title: "What's happening" }} />
      </div>
    </CityInsightContext.Provider>
  )
}

export const CITY_INSIGHT_CATALOG = { InsightCards, AnimatedNumber } as const
