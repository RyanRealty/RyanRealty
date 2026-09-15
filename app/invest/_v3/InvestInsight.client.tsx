'use client'

/**
 * beautifului-insight on /invest — real InsightCards (Insights pager,
 * Compare/Anomaly Liveline pointer-scrub, Allocation bar). Navy/cream
 * paint only. Do not wrap this in a house year pager.
 */
import InsightCards, {
  AllocationCard,
  AnomalyCard,
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

function pagesFromBoard(board: InvestInsightBoard): InsightPage[] {
  const pages: InsightPage[] = [
    {
      key: 'allocation',
      prose: (
        <>
          Lots are {board.landSharePct}% of income property for sale in Central Oregon — {board.landCount.toLocaleString('en-US')} of {board.total.toLocaleString('en-US')}.
        </>
      ),
      Card: function ForSaleAllocation() {
        return (
          <AllocationCard
            segments={board.allocation}
            note="For sale now, by type. Tap a segment to inspect that population. Shares add to the whole set."
          />
        )
      },
      pill: 'See every income listing for sale',
    },
  ]

  if (board.compare) {
    pages.push({
      key: 'compare',
      prose: (
        <>
          Lots against buildings across the three published windows: sold last 12 months, under contract, and for sale now.
        </>
      ),
      Card: function LotsVsBuildings() {
        const formatValue = (v: number) => Math.round(v).toLocaleString('en-US')
        return (
          <CompareCard
            series={board.compare!.map((s) => ({ ...s, formatValue }))}
            formatTime={() => ''}
          />
        )
      },
      pill: 'Scrub the three published windows',
    })
  }

  if (board.anomaly) {
    pages.push({
      key: 'anomaly',
      prose: (
        <>
          The unusual share is lots, not buildings. Toggle the two populations on the same three published windows.
        </>
      ),
      Card: function LandAnomaly() {
        return (
          <AnomalyCard
            data={board.anomaly!}
            labels={{
              title: 'Lots vs buildings',
              spend: 'Lots',
              usage: 'Buildings',
              formatSpend: (v) => Math.round(v).toLocaleString('en-US'),
              formatUsage: (v) => Math.round(v).toLocaleString('en-US'),
              spentLine: (value) => `${value} lots at the last published window`,
              vsLine: board.windowLabels.join(' · '),
            }}
            formatTime={() => ''}
          />
        )
      },
      pill: 'Toggle lots and buildings',
    })
  } else if (board.soldAllocation && board.soldTotal && board.soldLandCount) {
    pages.push({
      key: 'sold-allocation',
      prose: (
        <>
          Sold in the last 12 months, the mix is still lots-heavy — {board.soldLandCount.toLocaleString('en-US')} of {board.soldTotal.toLocaleString('en-US')}.
        </>
      ),
      Card: function SoldAllocation() {
        return (
          <AllocationCard
            segments={board.soldAllocation!}
            note="Closed in the last 12 months, by type. The same segment rows as the Pulse, sold window."
          />
        )
      },
      pill: 'How the last year closed',
    })
  }

  return pages
}
