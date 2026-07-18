'use client'

/**
 * ProspectPriceHistory — the prior-MLS-cycle list for the review detail
 * (spec 07 §2 detail content). Mobile renders stacked mini-rows; desktop
 * renders a compact <Table> inside its own overflow-x-auto box — per CLAUDE.md
 * this is the ONE place a small table may scroll internally; the page body
 * itself never scrolls horizontally.
 */

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

export function ProspectPriceHistory({ cycles }: { cycles: ProspectPriceCycle[] }) {
  if (cycles.length === 0) {
    return <p className="text-sm text-muted-foreground">No prior MLS listing history on file.</p>
  }

  return (
    <div className="space-y-3">
      {/* Phones — stacked mini-rows, one per cycle. */}
      <div className="space-y-2 sm:hidden">
        {cycles.map((cycle, i) => (
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
          </Card>
        ))}
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
            {cycles.map((cycle, i) => (
              <TableRow key={`${cycle.listDate ?? 'cycle'}-${i}`}>
                <TableCell className="text-sm">{formatDate(cycle.listDate)}</TableCell>
                <TableCell className="text-sm">{cycle.status ?? '—'}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatPrice(cycle.originalListPrice)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatPrice(cycle.finalListPrice)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatPrice(cycle.closePrice)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{cycle.daysOnMarket ?? '—'}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{cycle.priceDropCount ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
