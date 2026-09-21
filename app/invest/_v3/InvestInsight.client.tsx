'use client'

/**
 * beautifului-insight on /invest — real InsightCards (Insights pager,
 * Allocation bar + Liveline pointer-scrub on every page). Navy/cream
 * paint only. Compare KPI tiles stay off (hideLegend). Do not wrap
 * this in a house year pager.
 */
import InsightCards, {
  AllocationCard,
  CompareCard,
  type InsightPage,
} from '@/components/motion/insight-cards'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { useMemo } from 'react'
import type { InvestInsightBoard } from './invest-insight'

export function InvestInsight({ id, board }: { id: string; board: InvestInsightBoard }) {
  const pages = useMemo(() => pagesFromBoard(board), [board])
  if (pages.length < 2) return null

  return (
    <section id={id} className={`${V3_ROOT_CLASS} invest-insight`}>
      <div className="invest-insight__inner">
        <InsightCards pages={pages} labels={{ title: 'Insights' }} />
      </div>
    </section>
  )
}

function AllocationAndLiveline({
  segments,
  note,
  series,
}: {
  segments: InvestInsightBoard['allocation']
  note: string
  series: NonNullable<InvestInsightBoard['compare']>
}) {
  const formatValue = (v: number) => Math.round(v).toLocaleString('en-US')
  return (
    <div data-insight-combo="allocation-liveline">
      <AllocationCard segments={segments} note={note} />
      <CompareCard
        hideLegend
        series={series.map((s) => ({ ...s, formatValue }))}
        formatTime={() => ''}
      />
    </div>
  )
}

function pagesFromBoard(board: InvestInsightBoard): InsightPage[] {
  if (!board.compare) return []

  const series = board.compare
  const pages: InsightPage[] = [
    {
      key: 'for-sale',
      prose: (
        <>
          Lots are {board.landSharePct}% of income property for sale in Central Oregon:{' '}
          {board.landCount.toLocaleString('en-US')} lots against {board.buildingsCount.toLocaleString('en-US')}{' '}
          buildings, {board.total.toLocaleString('en-US')} in all.
        </>
      ),
      Card: function ForSaleMix() {
        return (
          <AllocationAndLiveline
            segments={board.allocation}
            note="For sale now, by type. Tap a segment to inspect that population. The line below is lots against buildings across the three published windows. Scrub it."
            series={series}
          />
        )
      },
      pill: 'See every income listing for sale',
    },
  ]

  if (board.soldAllocation && board.soldTotal && board.soldLandCount) {
    pages.push({
      key: 'sold',
      prose: (
        <>
          Sold in the last 12 months, the mix is still lots-heavy: {board.soldLandCount.toLocaleString('en-US')} of{' '}
          {board.soldTotal.toLocaleString('en-US')}. Same two populations on the line: lots against buildings.
        </>
      ),
      Card: function SoldMix() {
        return (
          <AllocationAndLiveline
            segments={board.soldAllocation!}
            note="Closed in the last 12 months, by type. The line is the same three published windows. Pointer-scrub to move through them."
            series={series}
          />
        )
      },
      pill: 'How the last year closed',
    })
  } else {
    pages.push({
      key: 'windows',
      prose: (
        <>
          Lots against buildings across the three published windows: sold last 12 months, under contract, and for sale
          now.
        </>
      ),
      Card: function WindowMix() {
        return (
          <AllocationAndLiveline
            segments={board.allocation}
            note="The bar is for sale now. The line is lots against buildings across the published windows. Scrub it."
            series={series}
          />
        )
      },
      pill: 'Scrub the three published windows',
    })
  }

  return pages
}
