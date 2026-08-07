// @no-parity — internal admin tool (brokerage P&L, TC rung 12)
//
// 11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
// worklist pattern (4). Presentation only — every figure on this page is money a
// broker gets paid, so nothing about how a number is produced or printed moved.
//
// THE FORMATTER STAYS. `money` is NOT routed through lib/format/money.ts.
// formatPrice rounds to the nearest $1,000 — it turns this page's $332 ad spend
// into $0 and its $586 net into $1,000. formatPriceExact agrees with `money` on
// every positive value, null and undefined, but diverges exactly where this page
// lives: net can be NEGATIVE, and there formatPriceExact prints -$4,200 where
// `money` prints $-4,200, and rounds -1234.5 to -$1,235 where Math.round gives
// $-1,234 (Math.round breaks .5 toward +∞; Intl breaks it away from zero). A
// different string or a different dollar on a P&L is a §0 figure change, not a
// presentation change, so the helper is carried character for character.
//
// Carried over verbatim: requireAdminPage('financials.view'), getTcFinancials(),
// the liveExpenses filter, `current = years[0]` (years arrive newest-first), the
// four summary figures and their labels, the eight P&L columns and their labels,
// the per-category breakdown and its `manualExpenses > 0` condition and
// amount-descending sort, the /admin/commissions href, the AddExpense and
// ExpenseLedger islands (mounted unchanged — both write to the ledger), and the
// methodology footnote.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the summary tiles became the family's typographic numbers strip
// (same four figures, same labels), and the two shadcn tables plus their phone
// card decks became ReportGrids that scroll inside their own box. The tile
// CAPTIONS are gone and no figure went with them — "2 closings", "agents
// $111,769", "ads $332 · other $0" are columns of the P&L grid for the same
// year, and "brokerage retained minus expenses" is the note under it.
//
// The verdict does NOT print the subtraction. Net is computed on the unrounded
// values (918.75 − 332.49 = 586.26 → $586), so a sentence reading "$919 minus
// $332" would invite the reader to arrive at $587. The displayed components live
// in the grid; the method note states the formula. §0: the narrative has to
// reconcile to the figure beside it.
import Link from 'next/link'
import {
  ReportGrid,
  ReportNumbers,
  SectionHead,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { getTcFinancials } from '@/app/actions/tc-financials'
import { requireAdminPage } from '@/lib/admin/require-admin'
import { TC_EXPENSE_CATEGORIES } from '@/lib/tc/expense-categories'
import { AddExpense } from './ExpenseControls'
import { ExpenseLedger } from './ExpenseLedger'

export const dynamic = 'force-dynamic'

const money = (v: number | null | undefined) =>
  v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`
const CATEGORY_LABEL = Object.fromEntries(TC_EXPENSE_CATEGORIES.map((c) => [c.value, c.label]))

const PL_COLUMNS: ReportColumn[] = [
  { key: 'year', label: 'Year' },
  { key: 'closings', label: 'Closings', numeric: true },
  { key: 'gci', label: 'Commission income', numeric: true },
  { key: 'agent', label: 'Agent share', numeric: true },
  { key: 'retained', label: 'Brokerage retained', numeric: true },
  { key: 'ads', label: 'Ad spend (auto)', numeric: true },
  { key: 'other', label: 'Other expenses', numeric: true },
  { key: 'net', label: 'Net', numeric: true },
]

const CATEGORY_COLUMNS: ReportColumn[] = [
  { key: 'year', label: 'Year' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount', numeric: true },
]

export default async function FinancialsPage() {
  // Brokerage P&L is superuser-only (D4/D3 money caps). The nav hides this from
  // brokers; the page must ENFORCE it too — a broker typing /admin/financials
  // otherwise reads the full P&L (audit HIGH, RC5 class).
  await requireAdminPage('financials.view')
  const { years, expenses } = await getTcFinancials()
  const liveExpenses = expenses.filter((e) => !e.archived)
  const current = years[0] // years come pre-sorted newest-first

  const plRows: ReportGridRow[] = years.map((y) => ({
    key: y.year,
    cells: [
      y.year,
      y.closings,
      money(y.gci),
      money(y.agentShare),
      money(y.brokerageRetained),
      money(y.adsSpend),
      money(y.manualExpenses),
      money(y.net),
    ],
  }))

  const categoryRows: ReportGridRow[] = years
    .filter((y) => y.manualExpenses > 0)
    .flatMap((y) =>
      Object.entries(y.expensesByCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => ({
          key: `${y.year}-${cat}`,
          cells: [y.year, CATEGORY_LABEL[cat] ?? cat, money(amt)],
        })),
    )

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={current && current.net >= 0 ? 'ok' : 'attention'}>
          {current ? (
            <>
              <b>
                Net {money(current.net)} in {current.year}.
              </b>{' '}
              {current.closings} closing{current.closings === 1 ? '' : 's'} settled this year. The
              row below carries what it is made of.
            </>
          ) : (
            <>
              <b>No year came back with a closing, an expense or an ad charge.</b> An empty read and
              a failed read look identical here, so this is not proof the ledger is empty.
            </>
          )}
        </VerdictLine>
      </div>

      <ReportNumbers
        items={
          current
            ? [
                { key: 'net', label: `Net · ${current.year}`, value: money(current.net) },
                { key: 'retained', label: 'Brokerage retained', value: money(current.brokerageRetained) },
                { key: 'gci', label: 'Commission income', value: money(current.gci) },
                { key: 'expenses', label: 'Expenses', value: money(current.totalExpenses) },
              ]
            : []
        }
      />

      <div className="av2-wordrow" style={{ margin: '0 0 4px' }}>
        <Link href="/admin/commissions" style={{ color: 'var(--a-accent)' }}>
          Commissions →
        </Link>
        <AddExpense />
      </div>

      <SectionHead>Profit and loss by year</SectionHead>
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 8px' }}>
        Verified and paid commissions, plus the brokerage expense ledger. Ad spend pulls live from
        the ads ledger. Net = brokerage retained minus expenses.
      </p>
      <ReportGrid
        label="Profit and loss by year"
        columns={PL_COLUMNS}
        template="minmax(56px, 0.5fr) minmax(64px, 0.5fr) repeat(6, minmax(96px, 1fr))"
        minWidth={860}
        rows={plRows}
        empty={
          <>
            No closed deal is on record yet. Verified commissions land here as transactions settle.
          </>
        }
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 12 }}>
        Agent share includes owner compensation (Matt at 100% split). Ad spend reads live from the
        marketing ads ledger so it is never double-entered here. Projected deals are excluded
        everywhere.
      </p>

      {categoryRows.length > 0 ? (
        <>
          <SectionHead>Expenses by category</SectionHead>
          <ReportGrid
            label="Expenses by category"
            columns={CATEGORY_COLUMNS}
            template="minmax(56px, 0.4fr) minmax(160px, 2fr) minmax(96px, 0.8fr)"
            minWidth={420}
            rows={categoryRows}
            empty={<>No manual expense is recorded against any year.</>}
          />
        </>
      ) : null}

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
    </div>
  )
}
