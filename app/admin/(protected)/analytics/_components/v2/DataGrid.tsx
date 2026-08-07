/**
 * DataGrid — the v2 language's tabular reader (11C, analytics family).
 *
 * The LOCKED admin language (design_system/admin/ADMIN_UI.md) has no <table>
 * primitive and bans raw <table> on migrated surfaces, so a data page renders
 * its rows as an ARIA grid built from the same tokens as everything else:
 *   - numbers are tabular (§1.4 "data is typographic"), units stay attached
 *     by the caller's own formatter
 *   - the ONLY horizontal scroll lives inside this component's own scroller,
 *     never on the page (a page that scrolls sideways is a failed design)
 *   - hairlines carry the structure; no shadows, no zebra fill
 *   - the four states each have a designed shape: GridSkeleton (loading),
 *     StatePanel (empty — says why + offers the next move; error — says the
 *     failure + the recovery), and Stamp (stale — carries its timestamp)
 *
 * Presentation only. Every figure, sort order, and cap is supplied by the
 * page; this file never computes a number.
 */
import type { ReactNode } from 'react'

export type GridColumn<T> = {
  key: string
  header: string
  /** Explicit grid track (e.g. '1.4fr', '160px'); defaults to a fluid min track. */
  width?: string
  /** Right-aligned + tabular numerals — every numeric column sets this. */
  numeric?: boolean
  cell: (row: T, index: number) => ReactNode
}

const HEAD_STYLE: React.CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--a-text-2)',
  whiteSpace: 'nowrap',
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

  return (
    <div>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${label} (scrolls sideways)`}
        // The class is what ci:admin-responsive can SEE (it scans class strings,
        // not inline styles); overflowX below is what actually applies. Keep
        // both — a grid that scrolls only by inline style reads to the gate as
        // a table with no mobile fallback, which is the #1 phone failure.
        className="overflow-x-auto"
        style={{
          width: '100%',
          overflowX: 'auto',
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-surface)',
        }}
      >
        <div role="table" aria-label={label} style={{ minWidth }}>
          <div
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns: template,
              gap: 'var(--a-s3)',
              padding: '9px var(--a-s4)',
              borderBottom: '1px solid var(--a-border)',
            }}
          >
            {columns.map((c) => (
              <div
                key={c.key}
                role="columnheader"
                style={{ ...HEAD_STYLE, textAlign: c.numeric ? 'right' : 'left' }}
              >
                {c.header}
              </div>
            ))}
          </div>
          {shown.map((row, i) => (
            <div
              key={getRowKey(row, i)}
              role="row"
              style={{
                display: 'grid',
                gridTemplateColumns: template,
                gap: 'var(--a-s3)',
                padding: '10px var(--a-s4)',
                alignItems: 'baseline',
                borderBottom: i === shown.length - 1 ? 'none' : '1px solid var(--a-border)',
                fontSize: 'var(--a-text-sm)',
                color: 'var(--a-text)',
              }}
            >
              {columns.map((c) => (
                <div
                  key={c.key}
                  role="cell"
                  style={{
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                    textAlign: c.numeric ? 'right' : 'left',
                    fontVariantNumeric: c.numeric ? 'tabular-nums' : undefined,
                  }}
                >
                  {c.cell(row, i)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {overflow > 0 ? (
        <p
          style={{
            fontSize: 'var(--a-text-xs)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
            margin: 'var(--a-s2) 0 0',
          }}
        >
          Showing {shown.length} of {rows.length}.
        </p>
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
