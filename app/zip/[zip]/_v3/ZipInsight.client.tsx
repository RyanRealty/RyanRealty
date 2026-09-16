'use client'

/**
 * SITE-114. The catalog InsightCards object on the ZIP market instrument.
 * Compare / Anomaly / Allocation stay the catalog cards. Digits are
 * beui-number. smoothLine is off so a scrubbed point is a close that happened.
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
import { zipSearchHref } from './zip-constants'
import {
  zipInsightCount,
  zipInsightDelta,
  zipInsightHasPages,
  zipInsightMoney,
  type ZipInsightBoard,
  type ZipMonthCell,
} from './zip-insight'
import './zip-insight.css'

function indexFor(progress: number | null, length: number): number | null {
  if (progress == null || length < 2) return null
  return Math.max(0, Math.min(length - 1, Math.round(progress * (length - 1))))
}

type ZipInsightState = {
  board: ZipInsightBoard
  zip: string
  compareAt: number | null
  paceAt: number | null
  paceMetric: 'spend' | 'usage'
  mixName: string | null
  setCompareAt: (progress: number | null) => void
  setPaceAt: (progress: number | null) => void
  setPaceMetric: (metric: 'spend' | 'usage') => void
  setMixName: (name: string) => void
}

const ZipInsightContext = createContext<ZipInsightState | null>(null)

function useZipInsight(): ZipInsightState {
  const value = useContext(ZipInsightContext)
  if (!value) throw new Error('ZipInsight card rendered outside its provider')
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
      className="zip-insight__digits"
      format={(n) => {
        if (Math.round(n) === Math.round(value)) return formatted
        return money ? zipInsightMoney(Math.max(0, n)) : zipInsightCount(Math.max(0, n))
      }}
    />
  )
}

function CompareMonths() {
  const { board, compareAt, setCompareAt } = useZipInsight()
  const compare = board.compare
  if (!compare) return null
  const at = compareAt
  const cell = at == null ? compare.cells[compare.cells.length - 1] : compare.cells[at]
  const priorCell =
    at == null ? compare.priorCells[compare.priorCells.length - 1] : compare.priorCells[at]
  return (
    <div>
      <CompareCard
        smoothLine={false}
        tickLabels={compare.cells.map((month) => month.short.slice(0, 3))}
        onScrubProgress={setCompareAt}
        renderValue={(value, formatted) => (
          <Figure value={value} formatted={formatted} money />
        )}
        series={[
          {
            name: compare.name,
            values: compare.values,
            sub: cell ? cell.label : compare.name,
            tone: 'green',
            dot: '',
            color: '',
            tooltipColor: '',
            formatValue: zipInsightMoney,
          },
          {
            name: compare.priorName,
            values: compare.priorValues,
            sub: priorCell ? priorCell.label : compare.priorName,
            tone: 'red',
            dot: '',
            color: '',
            tooltipColor: '',
            formatValue: zipInsightMoney,
          },
        ]}
      />
      <p className="insight-cards__note">{compare.source}</p>
    </div>
  )
}

function PaceMonths() {
  const { board, paceAt, setPaceAt, setPaceMetric } = useZipInsight()
  const pace = board.pace
  if (!pace) return null
  const at = paceAt ?? pace.cells.length - 1
  const cell = pace.cells[at] ?? pace.cells[pace.cells.length - 1]
  const peak = pace.cells[pace.peakIndex]
  return (
    <div>
      <AnomalyCard
        data={{ spend: pace.closings, usage: pace.medians }}
        tickLabels={pace.cells.map((month) => month.short.slice(0, 3))}
        onScrubProgress={setPaceAt}
        onMetric={setPaceMetric}
        renderValue={(value, formatted) => (
          <Figure value={value} formatted={formatted} money={formatted.startsWith('$')} />
        )}
        labels={{
          title: cell ? cell.label : 'Closed sales',
          spend: 'Homes closed',
          usage: 'Median sale',
          formatSpend: zipInsightCount,
          formatUsage: zipInsightMoney,
          spentLine: () =>
            peak && peak.closings != null
              ? `Busiest month on this line: ${peak.label}, ${zipInsightCount(peak.closings)} closings.`
              : 'Complete months, newest on the right.',
          vsLine: '',
        }}
      />
      <p className="insight-cards__note">{pace.source}</p>
    </div>
  )
}

function MixYear() {
  const { board, setMixName } = useZipInsight()
  const mix = board.mix
  if (!mix) return null
  const segments: AllocationSegment[] = mix.segments.map((segment) => ({
    name: segment.name,
    label: segment.label,
    pct: segment.pct,
    amount: segment.amount,
    cls: '',
    tone: '',
  }))
  const pcts = new Map(mix.segments.map((segment) => [segment.name, segment.pct]))
  return (
    <AllocationCard
      segments={segments}
      onSelect={(segment) => setMixName(segment.name)}
      renderAmount={(segment) => (
        <Figure
          value={pcts.get(segment.name) ?? 0}
          formatted={segment.amount}
          money={false}
        />
      )}
      note={mix.source}
    />
  )
}

function compareProse(
  board: ZipInsightBoard,
  at: number | null,
): { prose: ReactNode; cell: ZipMonthCell | null } | null {
  const compare = board.compare
  if (!compare) return null
  const index = at ?? compare.cells.length - 1
  const cell = compare.cells[index] ?? null
  const prior = compare.priorCells[index] ?? null
  if (!cell || !prior || cell.median == null || prior.median == null) return null
  const delta = zipInsightDelta(cell.median, prior.median)
  const direction =
    cell.median > prior.median ? 'more' : cell.median < prior.median ? 'less' : 'the same'
  return {
    cell,
    prose: (
      <>
        In {cell.label} the middle house in {board.scope} sold for{' '}
        <strong>{zipInsightMoney(cell.median)}</strong>. A year earlier, in {prior.label}, it was{' '}
        {zipInsightMoney(prior.median)}
        {delta ? ` — ${delta}` : ''}
        {direction === 'the same' ? ', level with a year ago' : `, ${direction} than the same month last year`}
        . Drag across the lines to read any other month.
      </>
    ),
  }
}

function paceProse(board: ZipInsightBoard, at: number | null) {
  const pace = board.pace
  if (!pace) return null
  const index = at ?? pace.cells.length - 1
  const cell = pace.cells[index]
  if (!cell || cell.closings == null || cell.median == null) return null
  const peak = pace.cells[pace.peakIndex]
  const isPeak = index === pace.peakIndex
  return (
    <>
      <strong>{zipInsightCount(cell.closings)}</strong> detached homes closed in {cell.label} in{' '}
      {board.scope}, at a median of {zipInsightMoney(cell.median)}.{' '}
      {isPeak
        ? 'That was the busiest month of this window.'
        : peak && peak.closings != null
          ? `${peak.label} was the busiest, at ${zipInsightCount(peak.closings)}.`
          : ''}{' '}
      Switch the metric, or drag across the line for another month.
    </>
  )
}

function mixProse(board: ZipInsightBoard, name: string | null) {
  const mix = board.mix
  if (!mix) return null
  const segment = mix.segments.find((item) => item.name === name) ?? mix.segments[0]
  if (!segment) return null
  const kind = mix.kind === 'bedrooms' ? 'bedroom mix' : 'financing mix'
  return (
    <>
      {segment.label} were <strong>{segment.amount}</strong> of the detached {kind} this page
      publishes for {board.place}. Tap a band to weigh another group.
    </>
  )
}

export function ZipInsight({ zip, board }: { zip: string; board: ZipInsightBoard }) {
  const [compareProgress, setCompareProgress] = useState<number | null>(null)
  const [paceProgress, setPaceProgress] = useState<number | null>(null)
  const [paceMetric, setPaceMetric] = useState<'spend' | 'usage'>('spend')
  const [mixName, setMixName] = useState<string | null>(null)

  const compareAt = indexFor(compareProgress, board.compare?.cells.length ?? 0)
  const paceAt = indexFor(paceProgress, board.pace?.cells.length ?? 0)

  const state = useMemo<ZipInsightState>(
    () => ({
      board,
      zip,
      compareAt,
      paceAt,
      paceMetric,
      mixName,
      setCompareAt: setCompareProgress,
      setPaceAt: setPaceProgress,
      setPaceMetric,
      setMixName,
    }),
    [board, zip, compareAt, paceAt, paceMetric, mixName],
  )

  if (!zipInsightHasPages(board)) return null

  const pages: InsightPage[] = []
  const mix = mixProse(board, mixName)
  if (board.mix && mix) {
    pages.push({
      key: 'mix',
      prose: mix,
      Card: MixYear,
      pill: `Browse ${zip}`,
      pillHref: zipSearchHref(zip),
    })
  }
  const compare = compareProse(board, compareAt)
  if (board.compare && compare) {
    pages.push({
      key: 'compare',
      prose: compare.prose,
      Card: CompareMonths,
      pill: `See homes for sale in ${zip}`,
      pillHref: zipSearchHref(zip),
    })
  }
  const pace = paceProse(board, paceAt)
  if (board.pace && pace) {
    pages.push({
      key: 'pace',
      prose: pace,
      Card: PaceMonths,
      pill: `${board.scope} market report`,
      pillHref: '/housing-market',
    })
  }
  if (pages.length < 2) return null

  return (
    <ZipInsightContext.Provider value={state}>
      <div className="zip-insight" id="insights" data-demo-state="insights">
        <InsightCards pages={pages} labels={{ title: board.place }} />
      </div>
    </ZipInsightContext.Provider>
  )
}
