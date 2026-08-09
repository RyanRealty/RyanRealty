/**
 * DataGrid — the analytics family's tabular reader.
 *
 * 11F CONVERGED: the grid itself is now <ReportGrid> from @/components/admin/v2,
 * the admin's ONE tabular reader. This file kept its own copy of that shape
 * through 11C, which meant two readers for one family — the drift the barrel
 * exists to stop. Everything a caller passes is unchanged (label, rows,
 * columns, getRowKey, cap, empty, minWidth), and the four designed states stay
 * here because ReportGrid does not carry them: StatePanel (empty/error),
 * GridSkeleton (loading), Stamp (stale/provenance), LaneNote, NumberStrip.
 *
 * What the convergence preserves, deliberately:
 *   - ARIA table roles — ReportGrid renders role="table"/"row"/"columnheader"/
 *     "cell" from the same markup this file did.
 *   - the keyboard-reachable scroll region — role="group" + tabIndex={0} +
 *     aria-label, with the ONLY horizontal scroll living inside it, never on
 *     the page.
 *   - phone stacking — report-grid.css turns each row into a titled block below
 *     720px, so a wide grid never scrolls sideways on a phone.
 *
 * Presentation only. Every figure, sort order, and cap is supplied by the
 * page; this file never computes a number.
 */
import type { ReactNode } from 'react'
import { ReportGrid, type ReportColumn, type ReportGridRow } from '@/components/admin/v2'

export type GridColumn<T> = {
  key: string
  header: string
  /** Explicit grid track (e.g. '1.4fr', '160px'); defaults to a fluid min track. */
  width?: string
  /** Right-aligned + tabular numerals — every numeric column sets this. */
  numeric?: boolean
  cell: (row: T, index: number) => ReactNode
}

export function DataGrid<T>({
  label,
  rows,
  columns,
  getRowKey,
  cap = 8,
  empty,
  minWidth = 640,
}: {
  /** Accessible name for the grid AND its scroll region. */
  label: string
  rows: T[]
  columns: GridColumn<T>[]
  getRowKey: (row: T, index: number) => string | number
  /** Max rows rendered before the "showing N of M" line. */
  cap?: number
  /** Designed empty state — why it is empty and what to do next. */
  empty: ReactNode
  /** Width below which the grid scrolls inside its own container. */
  minWidth?: number
}) {
  if (!rows || rows.length === 0) return <StatePanel>{empty}</StatePanel>

  const shown = rows.slice(0, cap)
  const overflow = rows.length - shown.length
  const template = columns.map((c) => c.width ?? 'minmax(84px, auto)').join(' ')

  const gridColumns: ReportColumn[] = columns.map((c) => ({
    key: c.key,
    label: c.header,
    numeric: c.numeric,
  }))
  const gridRows: ReportGridRow[] = shown.map((row, i) => ({
    key: String(getRowKey(row, i)),
    cells: columns.map((c) => c.cell(row, i)),
  }))

  return (
    <div>
      <ReportGrid
        label={label}
        columns={gridColumns}
        template={template}
        minWidth={minWidth}
        rows={gridRows}
        empty={empty}
      />
      {overflow > 0 ? (
        <Stamp>
          Showing {shown.length} of {rows.length}.
        </Stamp>
      ) : null}
    </div>
  )
}

/** Empty (quiet) and error (danger) both read as one calm panel. */
export function StatePanel({ tone = 'quiet', children }: { tone?: 'quiet' | 'error'; children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px ${tone === 'error' ? 'solid' : 'dashed'} ${tone === 'error' ? 'var(--a-danger)' : 'var(--a-border)'}`,
        borderRadius: 'var(--a-r-lg)',
        background: tone === 'error' ? 'var(--a-danger-wash)' : 'var(--a-surface)',
        color: tone === 'error' ? 'var(--a-danger)' : 'var(--a-text-2)',
        fontSize: 'var(--a-text-sm)',
        padding: 'var(--a-s5) var(--a-s4)',
      }}
    >
      {children}
    </div>
  )
}

/** Loading state — a still placeholder; the language forbids looping motion. */
export function GridSkeleton({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{
        border: '1px solid var(--a-border)',
        borderRadius: 'var(--a-r-lg)',
        background: 'var(--a-surface)',
        padding: 'var(--a-s4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--a-s3)',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <span
          key={i}
          style={{
            display: 'block',
            height: 12,
            borderRadius: 'var(--a-r-sm)',
            background: 'var(--a-inset)',
            width: i === 0 ? '38%' : `${92 - i * 7}%`,
          }}
        />
      ))}
    </div>
  )
}

/** Stale / provenance line — a figure's window and freshness travel with it. */
export function Stamp({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 'var(--a-text-xs)',
        color: 'var(--a-text-2)',
        fontVariantNumeric: 'tabular-nums',
        margin: 'var(--a-s2) 0 0',
      }}
    >
      {children}
    </p>
  )
}

/** Explanatory copy under a lane — the "how to read this" register. */
export function LaneNote({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 'var(--a-text-sm)',
        color: 'var(--a-text-2)',
        margin: '0 0 var(--a-s3)',
      }}
    >
      {children}
    </p>
  )
}

/** The numbers strip (pattern 3, week strip) — labelled figures, tabular. */
export function NumberStrip({
  items,
}: {
  items: Array<{ label: string; value: string | null; caption?: string | null }>
}) {
  return (
    <div className="av2-week" style={{ marginBottom: 'var(--a-s5)' }}>
      {items.map((it) => (
        <span key={it.label} className="av2-wk" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
          <span className="av2-wk__n" style={{ color: it.value === null ? 'var(--a-text-2)' : 'var(--a-text)' }}>
            {it.value ?? '—'}
          </span>
          <span className="av2-wk__l">{it.label}</span>
          {it.caption ? (
            <span className="av2-wk__l" style={{ fontSize: 'var(--a-text-xs)' }}>
              {it.caption}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  )
}
