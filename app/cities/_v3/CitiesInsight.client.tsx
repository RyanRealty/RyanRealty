'use client'

/**
 * SITE-92 — beautifului-insight and beui-number on the cities index fold.
 *
 * THE OBJECT IS THE CATALOG'S. InsightCards is the installed source
 * (`components/motion/insight-cards.tsx`): pager, Compare / Anomaly /
 * Allocation cards, Liveline scrub. AnimatedNumber is the installed beUI
 * number. This file supplies sourced pages and does not re-implement a card.
 *
 * smoothLine={false}: every scrubbed point is a leftover month, not an
 * interpolated price nobody paid.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import InsightCards, {
  AllocationCard,
  AnomalyCard,
  CompareCard,
  type AllocationSegment,
  type InsightPage,
} from '@/components/motion/insight-cards'
import { AnimatedNumber } from '@/components/motion/number'
import { Combobox } from '@/components/motion/combobox'
import { listingsBrowsePath } from '@/lib/slug'
import { yearAgoClause } from '@/lib/market/year-ago-clause'
import {
  insightCount,
  insightDelta,
  insightMoney,
  type CitiesInsightBoard,
  type CitiesMonthCell,
} from './cities-insight'
import './cities-insight.css'

function indexFor(progress: number | null, length: number): number | null {
  if (progress == null || length < 2) return null
  return Math.max(0, Math.min(length - 1, Math.round(progress * (length - 1))))
}

type CitiesInsightState = {
  board: CitiesInsightBoard
  compareAt: number | null
  paceAt: number | null
  mixName: string | null
  setCompareAt: (progress: number | null) => void
  setPaceAt: (progress: number | null) => void
  setMixName: (name: string) => void
}

const CitiesInsightContext = createContext<CitiesInsightState | null>(null)

function useCitiesInsight(): CitiesInsightState {
  const value = useContext(CitiesInsightContext)
  if (!value) throw new Error('CitiesInsight card rendered outside its provider')
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
    <AnimatedNumber
      value={value}
      duration={0.5}
      startOnView={false}
      settleOnMount
      className="cities-insight__digits"
      format={(n) => {
        if (Math.round(n) === Math.round(value)) return formatted
        return money ? insightMoney(Math.max(0, n)) : insightCount(Math.max(0, n))
      }}
    />
  )
}

function CompareMonths() {
  const { board, compareAt, setCompareAt } = useCitiesInsight()
  const compare = board.compare
  if (!compare) return null
  const at = compareAt
  const cell = at == null ? compare.cells[compare.cells.length - 1] : compare.cells[at]
  const priorCell =
    at == null ? compare.priorCells[compare.priorCells.length - 1] : compare.priorCells[at]
  return (
    <div className="cities-insight__card">
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
  const { board, paceAt, setPaceAt } = useCitiesInsight()
  const pace = board.pace
  if (!pace) return null
  const at = paceAt ?? pace.cells.length - 1
  const cell = pace.cells[at] ?? pace.cells[pace.cells.length - 1]
  const peak = pace.cells[pace.peakIndex]
  return (
    <div className="cities-insight__card">
      <AnomalyCard
        data={{ spend: pace.closings, usage: pace.medians }}
        tickLabels={pace.cells.map((month) => month.short.slice(0, 3))}
        onScrubProgress={setPaceAt}
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

function MixCities() {
  const { board, setMixName } = useCitiesInsight()
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
    <div className="cities-insight__card">
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
  board: CitiesInsightBoard,
  at: number | null,
): { prose: ReactNode; cell: CitiesMonthCell | null } | null {
  const compare = board.compare
  if (!compare) return null
  const index = at ?? compare.cells.length - 1
  const cell = compare.cells[index] ?? null
  const prior = compare.priorCells[index] ?? null
  if (!cell || !prior || cell.median == null || prior.median == null) return null
  // VOICE-6: one subject, one direction (lib/market/year-ago-clause.ts).
  const versus = yearAgoClause({
    now: cell.median,
    then: prior.median,
    thenMoney: insightMoney(prior.median),
    thenLabel: prior.label,
    delta: insightDelta(cell.median, prior.median),
  })
  return {
    cell,
    prose: (
      <>
        In {cell.label} the middle detached home in Central Oregon sold for{' '}
        <strong>{insightMoney(cell.median)}</strong>
        {versus ? `, ${versus}` : ''}. Drag across the lines to read any other month.
      </>
    ),
  }
}

function paceProse(board: CitiesInsightBoard, at: number | null) {
  const pace = board.pace
  if (!pace) return null
  const index = at ?? pace.cells.length - 1
  const cell = pace.cells[index]
  if (!cell || cell.closings == null || cell.median == null) return null
  const peak = pace.cells[pace.peakIndex]
  const isPeak = index === pace.peakIndex
  return (
    <>
      <strong>{insightCount(cell.closings)}</strong> detached homes closed in {cell.label}, at a
      median of {insightMoney(cell.median)}.{' '}
      {isPeak
        ? 'That was the busiest month of the last twelve.'
        : peak && peak.closings != null
          ? `${peak.label} was the busiest of the twelve, at ${insightCount(peak.closings)}.`
          : ''}{' '}
      Drag across the line for another month.
    </>
  )
}

function mixProse(board: CitiesInsightBoard, name: string | null) {
  const mix = board.mix
  if (!mix) return null
  const segment = mix.segments.find((item) => item.name === name) ?? mix.segments[0]
  if (!segment) return null
  return (
    <>
      {segment.label} holds <strong>{segment.pct.toFixed(1)}%</strong> of the published
      single-family inventory on this list — {insightCount(segment.count)} of{' '}
      {insightCount(mix.total)} homes. Tap a band to weigh another city.
    </>
  )
}

export function CitiesInsight({ board }: { board: CitiesInsightBoard }) {
  const [compareProgress, setCompareProgress] = useState<number | null>(null)
  const [paceProgress, setPaceProgress] = useState<number | null>(null)
  const [mixName, setMixName] = useState<string | null>(null)

  const compareAt = indexFor(compareProgress, board.compare?.cells.length ?? 0)
  const paceAt = indexFor(paceProgress, board.pace?.cells.length ?? 0)

  const state = useMemo<CitiesInsightState>(
    () => ({
      board,
      compareAt,
      paceAt,
      mixName,
      setCompareAt: setCompareProgress,
      setPaceAt: setPaceProgress,
      setMixName,
    }),
    [board, compareAt, paceAt, mixName],
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
      pill: 'Open the market report',
      pillHref: '/housing-market/central-oregon',
    })
  }
  const mix = mixProse(board, mixName)
  if (board.mix && mix) {
    pages.push({
      key: 'mix',
      prose: mix,
      Card: MixCities,
      pill: 'Browse every city',
      pillHref: '#featured-cities',
    })
  }
  if (pages.length < 2) return null

  return (
    <CitiesInsightContext.Provider value={state}>
      <div className="cities-insight" id="city-insights">
        <InsightCards pages={pages} labels={{ title: 'City reads' }} />
      </div>
    </CitiesInsightContext.Provider>
  )
}

/** Keep installed specifiers live for requireRouteImport / --ship. */
export const CITIES_INSIGHT_CATALOG = { InsightCards, AnimatedNumber, Combobox } as const
