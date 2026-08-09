'use client'

// @no-parity — internal admin tool (brokerage expense ledger view)
//
// 11F: taken off shadcn and onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only — the CAP of 6, the
// `expanded` toggle and both of its labels, the money/d10 formatters character
// for character, the /admin/deals/<encoded key> hrefs, the title attributes,
// the "Overhead" fallback and every user-visible string are untouched. Money on
// this page is money a broker gets paid, so no formatter moved (§0).
//
// Substitutions, and why each one:
//   Card/CardContent   -> .av2-pane, the language's bordered surface. The phone
//                         deck keeps its own breakpoint through .av2-cardlist
//                         (a CLASS, so no inline display can outrank it) —
//                         same 768px the md: utilities used.
//   Table              -> ReportGrid, the admin's one tabular reader. It is
//                         still wrapped in `hidden md:block` because the phone
//                         card deck above it already carries these rows; the
//                         grid would otherwise render a second copy at 375px.
//   Badge (category)   -> .av2-chip, never StateWord: .av2-state uppercases, and
//                         "MLS dues" is DATA, not a state word.
//   Button outline/ghost -> the v2 quiet Button. Neither is this file's primary
//                         action — "Save expense" in ExpenseControls is.
//   h2                 -> SectionHead, which owns the heading element.
//
// Surface stack, checked both ways in design_system/admin/tokens.css: the panes
// are --a-bg with a hairline on the page's --a-bg, and the chips are --a-surface
// with their own border. Nothing is painted onto its own parent's token.
import { useState } from 'react'
import Link from 'next/link'
import {
  Button,
  ReportGrid,
  SectionHead,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
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

const LEDGER_COLUMNS: ReportColumn[] = [
  { key: 'date', label: 'Date' },
  { key: 'category', label: 'Category' },
  { key: 'description', label: 'Description' },
  { key: 'deal', label: 'Deal' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'actions', label: 'Actions' },
]

/** Category label — DATA, so a chip and never a state word. */
function CategoryChip({ label }: { label: string }) {
  return (
    <span className="av2-chip" style={{ cursor: 'default' }}>
      {label}
    </span>
  )
}

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

  const rows: ReportGridRow[] = visible.map((e) => ({
    key: e.id,
    cells: [
      <span key="d" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {d10(e.incurredOn)}
      </span>,
      <CategoryChip key="c" label={e.categoryLabel} />,
      <span key="desc" title={e.description}>
        {e.description}
      </span>,
      e.dealPropertyKey ? (
        <Link
          key="deal"
          href={`/admin/deals/${encodeURIComponent(e.dealPropertyKey)}`}
          className="underline-offset-2 hover:underline"
          style={{ color: 'var(--a-text)' }}
          title={e.dealAddress ?? undefined}
        >
          {e.dealAddress ?? e.dealPropertyKey}
        </Link>
      ) : (
        <span key="deal" style={{ color: 'var(--a-text-2)' }}>
          Overhead
        </span>
      ),
      e.vendor ?? '—',
      money(e.amount),
      <ArchiveExpense key="act" id={e.id} description={e.description} />,
    ],
  }))

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <SectionHead>
          Expense ledger{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--a-text-2)' }}>
            ({total})
          </span>
        </SectionHead>
      </div>

      {total === 0 ? (
        <div
          className="av2-pane"
          style={{ padding: 'var(--a-s8) var(--a-s4)', gap: 'var(--a-s1)', textAlign: 'center' }}
        >
          <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)', margin: 0 }}>
            No expenses recorded yet
          </p>
          <p
            className="mx-auto max-w-sm"
            style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', margin: '4px auto 0' }}
          >
            Use &ldquo;Add expense&rdquo; to start the ledger. Deal-scoped costs (photography, signage,
            staging) or brokerage overhead (E&amp;O, MLS dues, software).
          </p>
        </div>
      ) : (
        <>
          {/* Expense cards — phones (one tap per expense, key facts mirrored) */}
          <div className="av2-cardlist">
            {visible.map((e) => (
              <div key={e.id} className="av2-pane" style={{ padding: 'var(--a-s3)', gap: 'var(--a-s2)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className="truncate"
                      style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)', margin: 0 }}
                      title={e.description}
                    >
                      {e.description}
                    </p>
                    <p
                      style={{
                        fontSize: 'var(--a-text-xs)',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'var(--a-text-2)',
                        margin: '4px 0 0',
                      }}
                    >
                      {d10(e.incurredOn)}
                    </p>
                  </div>
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 'var(--a-text-sm)',
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                      color: 'var(--a-text)',
                    }}
                  >
                    {money(e.amount)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CategoryChip label={e.categoryLabel} />
                  {e.dealPropertyKey ? (
                    <Link
                      href={`/admin/deals/${encodeURIComponent(e.dealPropertyKey)}`}
                      className="truncate underline-offset-2 hover:underline"
                      style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text)' }}
                      title={e.dealAddress ?? undefined}
                    >
                      {e.dealAddress ?? e.dealPropertyKey}
                    </Link>
                  ) : (
                    <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Overhead</span>
                  )}
                  {e.vendor ? (
                    <span className="truncate" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                      {e.vendor}
                    </span>
                  ) : null}
                </div>
                <div className="flex justify-end">
                  <ArchiveExpense id={e.id} description={e.description} />
                </div>
              </div>
            ))}
          </div>

          {/* Expense table — desktop */}
          <div className="hidden md:block">
            <ReportGrid
              label="Expense ledger"
              columns={LEDGER_COLUMNS}
              template="minmax(96px, 0.6fr) minmax(140px, 0.9fr) minmax(180px, 1.6fr) minmax(140px, 0.9fr) minmax(104px, 0.7fr) minmax(88px, 0.5fr) minmax(88px, 0.5fr)"
              minWidth={900}
              rows={rows}
              empty={<>No expense is recorded against this ledger yet.</>}
            />
          </div>

          {hiddenCount > 0 ? (
            <Button variant="quiet" className="w-full" onClick={() => setExpanded(true)}>
              See all {total} expenses
            </Button>
          ) : expanded && total > CAP ? (
            <Button variant="quiet" className="w-full" onClick={() => setExpanded(false)}>
              Show less
            </Button>
          ) : null}
        </>
      )}
    </section>
  )
}
