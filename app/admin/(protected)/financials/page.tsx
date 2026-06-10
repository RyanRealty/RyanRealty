// @no-parity — internal admin tool (brokerage P&L, TC rung 12)
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getTcFinancials } from '@/app/actions/tc-financials'
import { TC_EXPENSE_CATEGORIES } from '@/lib/tc/expense-categories'
import { AddExpense, ArchiveExpense } from './ExpenseControls'

export const dynamic = 'force-dynamic'

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const d10 = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '—')
const CATEGORY_LABEL = Object.fromEntries(TC_EXPENSE_CATEGORIES.map((c) => [c.value, c.label]))

export default async function FinancialsPage() {
  const { years, expenses } = await getTcFinancials()
  const liveExpenses = expenses.filter((e) => !e.archived)

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Financials</h1>
          <p className="text-sm text-muted-foreground">
            Revenue from settlement-verified commissions, expenses from the brokerage ledger, ad spend
            pulled automatically from the ads ledger. Net = brokerage retained minus expenses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/commissions"
            className="text-sm font-medium text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
          >
            Commissions →
          </Link>
          <AddExpense />
        </div>
      </header>

      {/* P&L by year */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-2">
          <p className="text-sm font-medium text-foreground">Profit & loss by year</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Year</TableHead>
              <TableHead className="w-24 text-right">Closings</TableHead>
              <TableHead className="text-right">Commission income</TableHead>
              <TableHead className="text-right">Agent share</TableHead>
              <TableHead className="text-right">Brokerage retained</TableHead>
              <TableHead className="text-right">Ad spend (auto)</TableHead>
              <TableHead className="text-right">Other expenses</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {years.map((y) => (
              <TableRow key={y.year}>
                <TableCell className="font-medium tabular-nums">{y.year}</TableCell>
                <TableCell className="text-right tabular-nums">{y.closings}</TableCell>
                <TableCell className="text-right tabular-nums">{money(y.gci)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(y.agentShare)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(y.brokerageRetained)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(y.adsSpend)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(y.manualExpenses)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{money(y.net)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          Agent share includes owner compensation (Matt at 100% split). Ad spend reads live from the
          marketing ads ledger so it is never double-entered here. Projected deals are excluded everywhere.
        </p>
      </div>

      {/* Expense breakdown per year */}
      {years.some((y) => y.manualExpenses > 0) ? (
        <div className="grid gap-3 md:grid-cols-2">
          {years
            .filter((y) => y.manualExpenses > 0)
            .map((y) => (
              <Card key={y.year}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{y.year} expenses by category</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {Object.entries(y.expensesByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => (
                      <p key={cat} className="flex justify-between text-sm tabular-nums">
                        <span className="text-muted-foreground">{CATEGORY_LABEL[cat] ?? cat}</span>
                        <span className="text-foreground">{money(amt)}</span>
                      </p>
                    ))}
                </CardContent>
              </Card>
            ))}
        </div>
      ) : null}

      {/* Expense ledger */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-2">
          <p className="text-sm font-medium text-foreground">
            Expense ledger <span className="tabular-nums text-muted-foreground">({liveExpenses.length})</span>
          </p>
        </div>
        {liveExpenses.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            No expenses recorded yet. Use &ldquo;Add expense&rdquo; to start the ledger — deal-scoped costs
            (photography, signage, staging) or brokerage overhead (E&O, MLS dues, software).
          </p>
        ) : (
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
              {liveExpenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tabular-nums">{d10(e.incurred_on)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{CATEGORY_LABEL[e.category] ?? e.category}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={e.description}>
                    {e.description}
                  </TableCell>
                  <TableCell className="max-w-[11rem] truncate">
                    {e.deal_property_key ? (
                      <Link
                        href={`/admin/deals/${encodeURIComponent(e.deal_property_key)}`}
                        className="text-foreground underline-offset-2 hover:underline"
                        title={e.deal_address ?? undefined}
                      >
                        {e.deal_address ?? e.deal_property_key}
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
        )}
      </div>
    </main>
  )
}
