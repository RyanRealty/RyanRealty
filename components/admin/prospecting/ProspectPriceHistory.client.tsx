'use client'

/**
 * ProspectPriceHistory — the prior-MLS-cycle list for the review detail
 * (spec 07 §2 detail content). Mobile renders stacked mini-rows; desktop
 * renders a compact <Table> inside its own overflow-x-auto box — per CLAUDE.md
 * this is the ONE place a small table may scroll internally; the page body
 * itself never scrolls horizontally.
 */

import * as React from 'react'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ProspectPriceCycle } from '@/lib/data/prospecting/types'
import { formatDate, formatPrice } from './format'

/** Statuses where a cycle is still in flight — no fall-through claim allowed. */
const IN_FLIGHT_STATUSES = ['Active', 'Pending', 'Active Under Contract', 'Coming Soon']

/**
 * The under-contract story for one cycle, from days_to_pending +
 * back_on_market_count. Returns null when the data shows no fall-through
 * (a clean list → close, a cycle that never went pending, or a cycle still
 * in flight) — the line only renders when the source columns prove it.
 */
export function underContractStory(cycle: ProspectPriceCycle): string | null {
  const boms = cycle.backOnMarketCount ?? 0
  if (cycle.daysToPending == null && boms === 0) return null

  const times = boms === 1 ? 'once' : `${boms} times`
  if (cycle.closePrice != null) {
    // Eventually closed — only a story when a contract fell through first.
    if (boms === 0) return null
    return cycle.daysToPending != null
      ? `Went pending after ${cycle.daysToPending} days, fell through ${times} before closing`
      : `Fell out of contract ${times} before closing`
  }

  if (IN_FLIGHT_STATUSES.includes(cycle.status ?? '')) return null
  const base =
    cycle.daysToPending != null
      ? `Went pending after ${cycle.daysToPending} days, fell through`
      : 'Went under contract, fell through'
  return boms > 1 ? `${base} (back on market ${boms} times)` : base
}

export function ProspectPriceHistory({ cycles }: { cycles: ProspectPriceCycle[] }) {
  if (cycles.length === 0) {
    return <p className="text-sm text-muted-foreground">No prior MLS listing history on file.</p>
  }

  return (
    <div className="space-y-3">
      {/* Phones — stacked mini-rows, one per cycle. */}
      <div className="space-y-2 sm:hidden">
        {cycles.map((cycle, i) => {
          const story = underContractStory(cycle)
          return (
          <Card key={`${cycle.listDate ?? 'cycle'}-${i}`} className="p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{formatDate(cycle.listDate)}</span>
              <span className="text-xs text-muted-foreground">{cycle.status ?? '—'}</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>List</span>
              <span className="tabular-nums text-foreground">
                {formatPrice(cycle.originalListPrice)}
                {cycle.finalListPrice != null && cycle.finalListPrice !== cycle.originalListPrice
                  ? ` → ${formatPrice(cycle.finalListPrice)}`
                  : ''}
              </span>
            </div>
            {cycle.closePrice != null ? (
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span>Closed</span>
                <span className="tabular-nums text-foreground">{formatPrice(cycle.closePrice)}</span>
              </div>
            ) : null}
            <div className="mt-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
              <span>Days on market · Price drops</span>
              <span className="tabular-nums">
                {cycle.daysOnMarket ?? '—'} · {cycle.priceDropCount ?? 0}
              </span>
            </div>
            {story ? <p className="mt-1 text-xs font-medium text-warning">{story}</p> : null}
          </Card>
          )
        })}
      </div>

      {/* Desktop — compact table, scrolls inside its own box only. */}
      <div className="no-scrollbar hidden overflow-x-auto rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>List date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Original list</TableHead>
              <TableHead className="text-right">Final list</TableHead>
              <TableHead className="text-right">Close</TableHead>
              <TableHead className="text-right">DOM</TableHead>
              <TableHead className="text-right">Drops</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycles.map((cycle, i) => {
              const story = underContractStory(cycle)
              return (
                <React.Fragment key={`${cycle.listDate ?? 'cycle'}-${i}`}>
                  <TableRow className={story ? 'border-b-0' : undefined}>
                    <TableCell className="text-sm">{formatDate(cycle.listDate)}</TableCell>
                    <TableCell className="text-sm">{cycle.status ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatPrice(cycle.originalListPrice)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatPrice(cycle.finalListPrice)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{formatPrice(cycle.closePrice)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{cycle.daysOnMarket ?? '—'}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{cycle.priceDropCount ?? 0}</TableCell>
                  </TableRow>
                  {story ? (
                    <TableRow>
                      <TableCell colSpan={7} className="pt-0 text-xs font-medium text-warning">
                        {story}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
