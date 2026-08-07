/**
 * Analytics v2 kit — the shapes the six locked patterns do not already carry,
 * built only from admin v2 tokens (design_system/admin/ADMIN_UI.md).
 *
 * Used exclusively by the analytics pages migrated in 11C (the hub,
 * google-search, listing-performance, lp-leaderboard, meta-health, social).
 * Everything here is presentation — no data reads, no formatting decisions:
 * callers pass already-formatted strings so the migration cannot move a number.
 *
 * CONVERGE ME: ./DataGrid.tsx landed in the same folder in the same 11C pass
 * and covers the same ground for the other six analytics pages
 * (DataGrid≈DataList, NumberStrip≈Figures, StatePanel≈empty/Trouble,
 * GridSkeleton≈Loading, LaneNote≈.av2-note, Stamp≈.av2-stamp). Two readers for
 * one family is drift. The merge worth keeping takes the stacking behaviour
 * here (a nine-column list must not scroll sideways on a phone — that is the
 * rule the retired TableWithMobileCards existed to enforce) plus the ARIA roles and
 * the keyboard-reachable scroll region from there.
 */
import './analytics-v2.css'
import '@/components/admin/v2/admin-v2.css'

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
 * Data list — one grid line per row on desktop, a stacked labelled block on
 * phone. A wide list scrolls inside .av2-dlwrap, never at page level.
 * `cap` + the "Showing N of M" line carry over the legacy table's contract
 * verbatim so a migrated page shows the same rows it showed before.
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
  const cls = (c: DataCol<T>) =>
    ['av2-dl__c', c.num ? 'av2-dl__c--num' : '', c.mono ? 'av2-dl__c--mono' : '', c.lead ? 'av2-dl__c--lead' : '']
      .filter(Boolean)
      .join(' ')

  return (
    <>
      <div className="av2-dlwrap">
        <ul className="av2-dl" aria-label={label}>
          <li className="av2-dl__head" style={{ gridTemplateColumns: template }} aria-hidden="true">
            {columns.map((c) => (
              <span key={c.key} className={c.num ? 'av2-dl__h--num' : undefined}>
                {c.header}
              </span>
            ))}
          </li>
          {shown.map((row, i) => (
            <li key={rowKey(row, i)} className="av2-dl__row" style={{ gridTemplateColumns: template }}>
              {columns.map((c) => (
                <span key={c.key} className={cls(c)} data-label={c.header}>
                  {c.cell(row, i)}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
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
}

/** Figure strip: data is typographic, tabular, and never a clickable tile. */
export function Figures({ figures }: { figures: Figure[] }) {
  return (
    <div className="av2-figs">
      {figures.map((f) => (
        <div key={f.label}>
          <div className={`av2-fig__n${f.tone ? ` av2-fig__n--${f.tone}` : ''}`}>{f.value}</div>
          <div className="av2-fig__l">{f.label}</div>
          {f.caption ? <div className="av2-fig__c">{f.caption}</div> : null}
        </div>
      ))}
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
