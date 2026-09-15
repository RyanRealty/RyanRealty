'use client'

/**
 * beautifului-insight on /cities — catalog InsightCards pages, one card each
 * (AllocationCard, then CompareCard). Navy/cream paint only. Do not stack
 * cards or wrap this in a house pager. CompareCard is a year scrubber
 * (month/year axis), not a liveline clock.
 */
import InsightCards, {
  AllocationCard,
  CompareCard,
  type InsightPage,
} from '@/components/motion/insight-cards'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { useMemo } from 'react'
import { citiesCatalogReady } from './cities-catalog'

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
  if (pages.length < 2) return null

  return (
    <section id={id} className={`${V3_ROOT_CLASS} cities-insight`}>
      <InsightCards pages={pages} labels={{ title: 'Insights' }} />
    </section>
  )
}

/** Month + year of the close, never a liveline clock axis. */
export function formatCloseYear(t: number) {
  return new Date(t * 1000).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
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
    formatValue: (v: number) => Math.round(v).toLocaleString('en-US'),
  }))
}

function pagesFromBoard(board: CitiesInsightBoard): InsightPage[] {
  if (board.allocation.length < 2) return []
  if (!board.compare || board.compare.length < 1 || board.compare[0]!.values.length < 6) return []

  const segments = board.allocation
  const note = board.allocationNote
  const series = livelineSeries(board.compare)

  return [
    {
      key: 'mix',
      prose: <>{board.allocationProse}</>,
      Card: function CityMix() {
        return <AllocationCard segments={segments} note={note} />
      },
      pill: 'See every city for sale',
    },
    {
      key: 'closes',
      prose: <>{board.compareProse}</>,
      Card: function CityCloses() {
        return (
          <CompareCard
            series={series}
            windowSecs={YEAR_WINDOW_SECS}
            formatTime={formatCloseYear}
          />
        )
      },
      pill: 'Scrub the year of closes',
    },
  ]
}
