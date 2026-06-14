// @no-parity — internal admin tool (brokerage P&L, TC rung 12)
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DashboardSummaryStrip, { type SummaryStat } from '@/components/admin/DashboardSummaryStrip'
import { getTcFinancials } from '@/app/actions/tc-financials'
import { TC_EXPENSE_CATEGORIES } from '@/lib/tc/expense-categories'
import { AddExpense } from './ExpenseControls'
import { ExpenseLedger } from './ExpenseLedger'

export const dynamic = 'force-dynamic'

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const CATEGORY_LABEL = Object.fromEntries(TC_EXPENSE_CATEGORIES.map((c) => [c.value, c.label]))

export default async function FinancialsPage() {
  const { years, expenses } = await getTcFinancials()
  const liveExpenses = expenses.filter((e) => !e.archived)
  const current = years[0] // years come pre-sorted newest-first

  const summary: SummaryStat[] = current
    ? [
        {
          label: `Net · ${current.year}`,
          value: money(current.net),
          caption: 'brokerage retained minus expenses',
          tone: current.net >= 0 ? 'success' : 'warning',
        },
        {
          label: 'Brokerage retained',
          value: money(current.brokerageRetained),
          caption: `${current.closings} closing${current.closings === 1 ? '' : 's'}`,
        },
        {
          label: 'Commission income',
          value: money(current.gci),
          caption: `agents ${money(current.agentShare)}`,
        },
        {
          label: 'Expenses',
          value: money(current.totalExpenses),
          caption: `ads ${money(current.adsSpend)} · other ${money(current.manualExpenses)}`,
        },
      ]
    : []

  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Financials</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Settlement-verified commissions and the brokerage expense ledger. Ad spend pulls live from
            the ads ledger. Net = brokerage retained minus expenses.
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

      {/* Glanceable summary — the bottom-line numbers for the current year, no scroll */}
      {summary.length ? <DashboardSummaryStrip stats={summary} /> : null}

      {/* P&L by year */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-foreground">Profit &amp; loss by year</h2>

        {years.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No closed deals on record yet. Verified commissions land here as transactions settle.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Per-year cards — phones (the wide table won't fit; lead with the bottom line) */}
            <div className="space-y-3 md:hidden">
              {years.map((y) => (
                <Card key={y.year} size="sm">
                  <CardHeader className="flex flex-row items-baseline justify-between gap-2 pb-2">
                    <CardTitle className="text-base tabular-nums">{y.year}</CardTitle>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {y.closings} closing{y.closings === 1 ? '' : 's'}
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">Net</span>
                      <span
                        className={
                          'text-xl font-semibold tabular-nums ' +
                          (y.net >= 0 ? 'text-success' : 'text-warning')
                        }
                      >
                        {money(y.net)}
                      </span>
                    </div>
                    <dl className="space-y-1 border-t border-border pt-2 text-sm tabular-nums">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Commission income</dt>
                        <dd className="text-foreground">{money(y.gci)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Agent share</dt>
                        <dd className="text-foreground">{money(y.agentShare)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Brokerage retained</dt>
                        <dd className="text-foreground">{money(y.brokerageRetained)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Ad spend (auto)</dt>
                        <dd className="text-foreground">{money(y.adsSpend)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Other expenses</dt>
                        <dd className="text-foreground">{money(y.manualExpenses)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Full P&L table — desktop (unchanged) */}
            <div className="hidden rounded-lg border border-border bg-card md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Year</TableHead>
                    <TableHead className="w-24 text-right">Closings</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Commission income</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Agent share</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Brokerage retained</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Ad spend (auto)</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Other expenses</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {years.map((y) => (
                    <TableRow key={y.year}>
                      <TableCell className="font-medium tabular-nums">{y.year}</TableCell>
                      <TableCell className="text-right tabular-nums">{y.closings}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{money(y.gci)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{money(y.agentShare)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{money(y.brokerageRetained)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{money(y.adsSpend)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{money(y.manualExpenses)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{money(y.net)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <p className="max-w-prose text-xs text-muted-foreground">
          Agent share includes owner compensation (Matt at 100% split). Ad spend reads live from the
          marketing ads ledger so it is never double-entered here. Projected deals are excluded everywhere.
        </p>
      </section>

      {/* Expense breakdown per year */}
      {years.some((y) => y.manualExpenses > 0) ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-foreground">Expenses by category</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {years
              .filter((y) => y.manualExpenses > 0)
              .map((y) => (
                <Card key={y.year} size="sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{y.year}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {Object.entries(y.expensesByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amt]) => (
                        <p key={cat} className="flex justify-between gap-2 text-sm tabular-nums">
                          <span className="text-muted-foreground">{CATEGORY_LABEL[cat] ?? cat}</span>
                          <span className="text-foreground">{money(amt)}</span>
                        </p>
                      ))}
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>
      ) : null}

      {/* Expense ledger — capped, with "See all" */}
      <ExpenseLedger
        expenses={liveExpenses.map((e) => ({
          id: e.id,
          description: e.description,
          incurredOn: e.incurred_on,
          amount: e.amount,
          categoryLabel: CATEGORY_LABEL[e.category] ?? e.category,
          dealPropertyKey: e.deal_property_key,
          dealAddress: e.deal_address,
          vendor: e.vendor,
        }))}
      />
    </main>
  )
}
