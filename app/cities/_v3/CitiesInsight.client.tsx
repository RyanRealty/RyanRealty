'use client'

/**
 * beautifului-insight on /cities — catalog InsightCards as one rest object
 * (AllocationCard + CompareCard Liveline). Navy/cream paint only. KPI
 * legend stays off (hideLegend). Year scrubber track/handle stays.
 */
import InsightCards, {
  AllocationCard,
  CompareCard,
  type InsightPage,
} from '@/components/motion/insight-cards'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { useMemo } from 'react'
import { citiesCatalogReady } from './cities-catalog'
import { formatCloseYear } from './cities-insight-months'

export { formatCloseYear, formatPublishedCloseMonth } from './cities-insight-months'

void citiesCatalogReady

/** Twelve months of closes, in seconds. Liveline windows around now. */
export const YEAR_WINDOW_SECS = 365 * 24 * 60 * 60

export type CitiesInsightSegment = {
  name: string
  label: string
  amount: string
  pct: number
  cls: string
  tone: string
}

export type CitiesInsightSeries = {
  name: string
  values: number[]
  sub: string
  times?: number[]
  labels?: string[]
}

export type CitiesInsightBoard = {
  allocation: CitiesInsightSegment[]
  allocationNote: string
  allocationProse: string
  compare: CitiesInsightSeries[] | null
  compareProse: string
}

export function CitiesInsight({ id, board }: { id: string; board: CitiesInsightBoard }) {
  const pages = useMemo(() => pagesFromBoard(board), [board])
  if (pages.length < 1) return null

  return (
    <section id={id} className={`${V3_ROOT_CLASS} cities-insight`}>
      <InsightCards pages={pages} labels={{ title: 'Insights' }} />
    </section>
  )
}

function livelineSeries(series: CitiesInsightSeries[]) {
  return series.map((s) => ({
    name: s.name,
    values: s.values,
    sub: s.sub,
    tone: 'green' as const,
    dot: 'bg-accent',
    color: '',
    tooltipColor: '',
    times: s.times,
    formatValue: (v: number) => Math.round(v).toLocaleString('en-US'),
  }))
}

function pagesFromBoard(board: CitiesInsightBoard): InsightPage[] {
  if (board.allocation.length < 2) return []
  if (!board.compare || board.compare.length < 1 || board.compare[0]!.values.length < 6) return []

  const segments = board.allocation
  const note = board.allocationNote
  const series = livelineSeries(board.compare)
  const monthLabels = board.compare[0]?.labels

  return [
    {
      key: 'mix-closes',
      prose: <>{board.allocationProse} {board.compareProse}</>,
      Card: function CityMixAndCloses() {
        return (
          <>
            <AllocationCard segments={segments} note={note} />
            <CompareCard
              hideLegend
              series={series}
              windowSecs={YEAR_WINDOW_SECS}
              formatTime={formatCloseYear}
              monthLabels={monthLabels}
            />
          </>
        )
      },
      pill: 'See every city for sale',
    },
  ]
}
