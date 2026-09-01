/**
 * Analytics v2 kit — the shapes the six locked patterns do not already carry,
 * built only from admin v2 tokens (design_system/admin/ADMIN_UI.md).
 *
 * Used exclusively by the analytics pages migrated in 11C (the hub,
 * google-search, listing-performance, lp-leaderboard, meta-health, social).
 * Everything here is presentation — no data reads, no formatting decisions:
 * callers pass already-formatted strings so the migration cannot move a number.
 *
 * 11F CONVERGED: DataList and ./DataGrid both drew their own tabular reader in
 * the same 11C pass — two readers for one family, which is the drift the v2
 * barrel exists to stop. Both now render <ReportGrid> from
 * @/components/admin/v2, the admin's ONE grid, so the analytics family reads
 * exactly like the reporting family. Nothing about DataList's contract moved
 * (rows, columns, rowKey, cap, empty, label; the `cap` + "Showing N of M" line
 * still carry the legacy table's contract verbatim), and the three properties
 * worth keeping came along with it:
 *   - phone stacking — report-grid.css makes each row a titled block below
 *     720px, so a nine-column list still never scrolls sideways on a phone;
 *     that is the rule the retired TableWithMobileCards existed to enforce.
 *   - ARIA table roles — role="table"/"row"/"columnheader"/"cell".
 *   - a keyboard-reachable scroll region — role="group" + tabIndex, owning the
 *     ONLY horizontal scroll on the page.
 */
import './analytics-v2.css'
import '@/components/admin/v2/admin-v2.css'
import { ReportGrid, type ReportColumn, type ReportGridRow } from '@/components/admin/v2'

export type DataCol<T> = {
  key: string
  header: string
  /** Right-aligned + tabular numerals (every figure on these pages). */
  num?: boolean
  /** Identifier column — mono, per ADMIN_UI §2 (mono for ids). */
  mono?: boolean
  /** The row's name column: the phone title line. Exactly one per list. */
  lead?: boolean
  /** Grid track for this column at ≥760px. */
  width?: string
  cell: (row: T, index: number) => React.ReactNode
}

/**
 * Data list — one grid line per row on desktop, a stacked titled block on
 * phone. A wide list scrolls inside the grid's own scroll region, never at
 * page level. The FIRST column is the phone title line, which is where `lead`
 * has always been set.
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  cap = 8,
  empty,
  label,
}: {
  rows: T[]
  columns: DataCol<T>[]
  rowKey: (row: T, index: number) => string | number
  cap?: number
  /** Designed empty state: why it is empty and what fills it. */
  empty: React.ReactNode
  label: string
}) {
  if (!rows || rows.length === 0) {
    return <div className="av2-empty">{empty}</div>
  }
  const shown = rows.slice(0, cap)
  const overflow = rows.length - shown.length
  const template = columns.map((c) => c.width ?? (c.lead ? 'minmax(0, 1.6fr)' : 'auto')).join(' ')

  const gridColumns: ReportColumn[] = columns.map((c) => ({
    key: c.key,
    label: c.header,
    numeric: c.num,
  }))
  const gridRows: ReportGridRow[] = shown.map((row, i) => ({
    key: String(rowKey(row, i)),
    cells: columns.map((c) =>
      c.mono ? (
        <span key={c.key} style={{ fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-xs)' }}>
          {c.cell(row, i)}
        </span>
      ) : (
        c.cell(row, i)
      ),
    ),
  }))

  return (
    <>
      <ReportGrid
        label={label}
        columns={gridColumns}
        template={template}
        minWidth={0}
        rows={gridRows}
        empty={empty}
      />
      {overflow > 0 ? (
        <p className="av2-stamp">
          Showing {shown.length} of {rows.length}.
        </p>
      ) : null}
    </>
  )
}

export type Figure = {
  label: string
  /** Pre-formatted — units attached, never a bare number. */
  value: string
  caption?: string | null
  tone?: 'ok' | 'warn'
  /** Door to the filtered list/section that explains this figure (bar rule 4). */
  href?: string
}

/**
 * Figure strip: data is typographic and tabular. A figure with an `href` is a
 * quiet door to the rows that explain it — never a navigation tile.
 */
export function Figures({ figures }: { figures: Figure[] }) {
  return (
    <div className="av2-figs">
      {figures.map((f) => {
        const body = (
          <>
            <div className={`av2-fig__n${f.tone ? ` av2-fig__n--${f.tone}` : ''}`}>{f.value}</div>
            <div className="av2-fig__l">{f.label}</div>
            {f.caption ? <div className="av2-fig__c">{f.caption}</div> : null}
          </>
        )
        return f.href ? (
          <a key={f.label} href={f.href} style={{ color: 'inherit', textDecoration: 'none' }}>
            {body}
          </a>
        ) : (
          <div key={f.label}>{body}</div>
        )
      })}
    </div>
  )
}

/** Error state: what broke, and the way back. */
export function Trouble({ children }: { children: React.ReactNode }) {
  return <div className="av2-empty av2-empty--bad">{children}</div>
}

/** Loading state: a reserved block that says what is loading. Nothing loops. */
export function Loading({ what }: { what: string }) {
  return <div className="av2-skel">Reading {what}…</div>
}
