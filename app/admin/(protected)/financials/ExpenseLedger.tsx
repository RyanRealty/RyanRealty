'use client'

// @no-parity — internal admin tool (brokerage expense ledger view)
import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArchiveExpense } from './ExpenseControls'

export type LedgerExpense = {
  id: string
  description: string
  incurredOn: string | null
  amount: number
  categoryLabel: string
  dealPropertyKey: string | null
  dealAddress: string | null
  vendor: string | null
}

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '—')

const CAP = 6

/**
 * Expense ledger — curated, never a dump. Shows the most recent CAP expenses,
 * then a "See all (N)" toggle. Phones get scannable cards; desktop keeps the
 * full table. Designed empty state when the ledger is clean.
 */
export function ExpenseLedger({ expenses }: { expenses: LedgerExpense[] }) {
  const [expanded, setExpanded] = useState(false)
  const total = expenses.length
  const visible = expanded ? expenses : expenses.slice(0, CAP)
  const hiddenCount = total - visible.length

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">
          Expense ledger{' '}
          <span className="tabular-nums text-muted-foreground">({total})</span>
        </h2>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="space-y-1 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No expenses recorded yet</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Use &ldquo;Add expense&rdquo; to start the ledger. Deal-scoped costs (photography, signage,
              staging) or brokerage overhead (E&amp;O, MLS dues, software).
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Expense cards — phones (one tap per expense, key facts mirrored) */}
          <div className="space-y-2 md:hidden">
            {visible.map((e) => (
              <Card key={e.id} size="sm">
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground" title={e.description}>
                        {e.description}
                      </p>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">{d10(e.incurredOn)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {money(e.amount)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{e.categoryLabel}</Badge>
                    {e.dealPropertyKey ? (
                      <Link
                        href={`/admin/deals/${encodeURIComponent(e.dealPropertyKey)}`}
                        className="truncate text-xs text-foreground underline-offset-2 hover:underline"
                        title={e.dealAddress ?? undefined}
                      >
                        {e.dealAddress ?? e.dealPropertyKey}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">Overhead</span>
                    )}
                    {e.vendor ? (
                      <span className="truncate text-xs text-muted-foreground">{e.vendor}</span>
                    ) : null}
                  </div>
                  <div className="flex justify-end">
                    <ArchiveExpense id={e.id} description={e.description} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Expense table — desktop */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-44">Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-44">Deal</TableHead>
                  <TableHead className="w-32">Vendor</TableHead>
                  <TableHead className="w-24 text-right">Amount</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums">{d10(e.incurredOn)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{e.categoryLabel}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={e.description}>
                      {e.description}
                    </TableCell>
                    <TableCell className="max-w-[11rem] truncate">
                      {e.dealPropertyKey ? (
                        <Link
                          href={`/admin/deals/${encodeURIComponent(e.dealPropertyKey)}`}
                          className="text-foreground underline-offset-2 hover:underline"
                          title={e.dealAddress ?? undefined}
                        >
                          {e.dealAddress ?? e.dealPropertyKey}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Overhead</span>
                      )}
                    </TableCell>
                    <TableCell className="truncate">{e.vendor ?? '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(e.amount)}</TableCell>
                    <TableCell className="text-right">
                      <ArchiveExpense id={e.id} description={e.description} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hiddenCount > 0 ? (
            <Button variant="outline" className="w-full" onClick={() => setExpanded(true)}>
              See all {total} expenses
            </Button>
          ) : expanded && total > CAP ? (
            <Button variant="ghost" className="w-full" onClick={() => setExpanded(false)}>
              Show less
            </Button>
          ) : null}
        </>
      )}
    </section>
  )
}
