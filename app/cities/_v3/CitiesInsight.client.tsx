'use client'

/**
 * beautifului-insight on /cities — real InsightCards (Insights pager,
 * Allocation bar + Liveline pointer-scrub). Navy/cream paint only.
 * Compare KPI tiles stay off (hideLegend). Do not wrap this in a house year pager.
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

function AllocationAndLiveline({
  segments,
  note,
  series,
}: {
  segments: CitiesInsightSegment[]
  note: string
  series: CitiesInsightSeries[]
}) {
  return (
    <div data-insight-combo="allocation-liveline">
      <AllocationCard segments={segments} note={note} />
      <CompareCard hideLegend series={livelineSeries(series)} formatTime={() => ''} />
    </div>
  )
}

function pagesFromBoard(board: CitiesInsightBoard): InsightPage[] {
  if (board.allocation.length < 2) return []
  if (!board.compare || board.compare.length < 1 || board.compare[0]!.values.length < 6) return []

  const segments = board.allocation
  const note = board.allocationNote
  const series = board.compare

  return [
    {
      key: 'mix',
      prose: <>{board.allocationProse}</>,
      Card: function CityMix() {
        return <AllocationAndLiveline segments={segments} note={note} series={series} />
      },
      pill: 'See every city for sale',
    },
    {
      key: 'closes',
      prose: <>{board.compareProse}</>,
      Card: function CityCloses() {
        return <AllocationAndLiveline segments={segments} note={note} series={series} />
      },
      pill: 'Scrub the year of closes',
    },
  ]
}
