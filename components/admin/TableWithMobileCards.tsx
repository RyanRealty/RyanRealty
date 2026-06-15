import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/**
 * TableWithMobileCards — the curate-and-never-dump table primitive for admin.
 *
 * From the same `rows`, renders a capped desktop `<Table>` AND a `md:hidden`
 * card list, with a built-in "See all (N) →" and a designed empty state. This
 * satisfies three of the ADMIN_DESIGN_STANDARD HARD laws at once: law 1 (cap, no
 * dump), law 3 (every state designed — the empty + the "showing N of M"), and
 * law 4 (thumb-first — no wide-table horizontal overflow on a phone). Adopt it
 * on every analytics/reports page that currently renders a bare wide table.
 */

export type TwmcColumn<T> = {
  key: string
  header: React.ReactNode
  className?: string
  cell: (row: T) => React.ReactNode
}

export function TableWithMobileCards<T>({
  rows,
  columns,
  renderCard,
  getRowKey,
  cap = 8,
  seeAllHref,
  seeAllLabel,
  empty,
}: {
  rows: T[]
  columns: TwmcColumn<T>[]
  /** Mobile (`md:hidden`) card for one row. Keep it to ~2 lines + a status pill. */
  renderCard: (row: T) => React.ReactNode
  getRowKey: (row: T, index: number) => string | number
  /** Max rows shown on BOTH surfaces before "See all". Default 8. */
  cap?: number
  seeAllHref?: string
  seeAllLabel?: string
  /** Designed empty state — what to do next, not a blank gap. */
  empty: React.ReactNode
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    )
  }

  const shown = rows.slice(0, cap)
  const overflow = rows.length - shown.length

  return (
    <div className="space-y-3">
      {/* Mobile: cards */}
      <div className="space-y-2 md:hidden">
        {shown.map((row, i) => (
          <div key={getRowKey(row, i)}>{renderCard(row)}</div>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>{c.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row, i) => (
              <TableRow key={getRowKey(row, i)} className="hover:bg-accent/40">
                {columns.map((c) => (
                  <TableCell key={c.key} className={c.className}>{c.cell(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {overflow > 0 ? (
        seeAllHref ? (
          <Link href={seeAllHref} className="inline-flex text-sm font-medium text-foreground hover:underline">
            {seeAllLabel ?? `See all ${rows.length} →`}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground tabular-nums">Showing {shown.length} of {rows.length}.</p>
        )
      ) : null}
    </div>
  )
}
