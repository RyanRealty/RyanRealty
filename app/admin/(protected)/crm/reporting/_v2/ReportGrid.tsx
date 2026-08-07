// @no-parity — internal admin surface, no public mockup contract
/**
 * The reporting family's v2 presentation kit (11C).
 *
 * Server components only — no state, no data access, no query-param handling.
 * Every page below /admin/crm/reporting that has migrated to the LOCKED admin
 * language (design_system/admin/ADMIN_UI.md) renders through these so the five
 * screens cannot drift apart the way the thirteen shadcn tables did.
 *
 * What the acceptance bar asks of a DATA page, and where it is answered here:
 *   - tabular numerals on every figure ....... .av2-rgrid__c--n / .av2-rnum__v
 *   - sideways scroll inside its own box ..... <ReportGrid> owns .av2-rgrid__scroll
 *   - four states designed ................... <ReportSkeleton> (loading.tsx),
 *     <ReportGrid empty>, <ReportError>, <ReportFreshness> (stale + timestamp)
 *   - entity names are doors ................. the page passes a <Link> as the cell
 */
import './report-grid.css'
import { formatDate } from '@/lib/format/date'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

// ── Grid ──────────────────────────────────────────────────────────────────────

export type ReportColumn = {
  key: string
  label: string
  /** Right-aligned + tabular on desktop. Every figure column is numeric. */
  numeric?: boolean
}

export type ReportGridRow = {
  key: string
  /** One entry per column, in column order. */
  cells: ReactNode[]
  /** Renders as the summary/total row (hairline above, no rule below). */
  total?: boolean
}

export function ReportGrid({
  label,
  columns,
  template,
  minWidth,
  rows,
  empty,
}: {
  /** Accessible name for the grid and its scroll region. */
  label: string
  columns: ReportColumn[]
  /** Desktop `grid-template-columns` value (>=720px). */
  template: string
  /** Width below which the grid scrolls INSIDE its container, never the page. */
  minWidth: number
  rows: ReportGridRow[]
  /** Empty state: say why it is empty and what to do next. */
  empty: ReactNode
}) {
  const style = {
    '--rgrid-cols': template,
    '--rgrid-min': `${minWidth}px`,
  } as CSSProperties

  return (
    <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label={label}>
      <div className="av2-rgrid" role="table" aria-label={label} style={style}>
        <div className="av2-rgrid__head" role="row">
          {columns.map((c) => (
            <span
              key={c.key}
              role="columnheader"
              className={c.numeric ? 'av2-rgrid__h av2-rgrid__h--n' : 'av2-rgrid__h'}
            >
              {c.label}
            </span>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="av2-rgrid__empty" role="row">
            <span role="cell">{empty}</span>
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.key}
              role="row"
              className={r.total ? 'av2-rgrid__row av2-rgrid__row--sum' : 'av2-rgrid__row'}
            >
              {r.cells.map((cell, i) => (
                <span
                  key={columns[i].key}
                  role="cell"
                  data-label={columns[i].label}
                  className={
                    columns[i].numeric ? 'av2-rgrid__c av2-rgrid__c--n' : 'av2-rgrid__c'
                  }
                >
                  {cell}
                </span>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Numbers strip ─────────────────────────────────────────────────────────────

export type ReportNumberItem = {
  key: string
  label: string
  /** Pre-formatted display string — the page owns every number's formatting. */
  value: string
  /** Change vs the comparison period, already computed by the page. */
  delta?: { text: string; direction: 'up' | 'down' | 'flat' }
  /** Per-day shape for the period, in order. Omit for time metrics. */
  spark?: number[]
  /** One quiet link out of the figure (e.g. Calls → Call Logs). */
  aux?: { href: string; label: string }
}

/** A period's figures as text, per the locked rule that KPIs never open a screen. */
export function ReportNumbers({ items }: { items: ReportNumberItem[] }) {
  return (
    <div className="av2-rnum">
      {items.map((it) => (
        <span key={it.key} className="av2-rnum__i">
          <span className="av2-rnum__l">
            {it.label}
            {it.aux ? (
              <>
                {' '}
                <Link href={it.aux.href} className="av2-rnum__aux">
                  {it.aux.label}
                </Link>
              </>
            ) : null}
          </span>
          <span className="av2-rnum__v">{it.value}</span>
          {it.delta ? (
            <span
              className={
                it.delta.direction === 'up'
                  ? 'av2-rnum__d av2-rnum__d--up'
                  : it.delta.direction === 'down'
                    ? 'av2-rnum__d av2-rnum__d--down'
                    : 'av2-rnum__d'
              }
            >
              {it.delta.text}
            </span>
          ) : null}
          {it.spark && it.spark.length > 1 ? <Sparkline data={it.spark} /> : null}
        </span>
      ))}
    </div>
  )
}

/** Per-day shape, drawn from the same series the figure sums. No library, no hex. */
function Sparkline({ data }: { data: number[] }) {
  const w = 92
  const h = 18
  const max = Math.max(...data, 1)
  const step = data.length > 1 ? w / (data.length - 1) : w
  const points = data
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`)
    .join(' ')
  return (
    <svg
      className="av2-rnum__spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      focusable="false"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Goal meter ────────────────────────────────────────────────────────────────

/** Progress toward a goal. Text carries the number; the bar is decoration. */
export function GoalMeter({ pct }: { pct: number }) {
  return (
    <span className="av2-rmeter">
      <span
        className="av2-rmeter__track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="av2-rmeter__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="av2-rmeter__pct">{pct}%</span>
    </span>
  )
}

// ── Freshness (the "stale" state: say when this was read) ─────────────────────


export function asOfLabel(nowMs: number): string {
  return formatDate(nowMs, { hour: 'numeric', minute: '2-digit' })
}

/** Cache age + the read timestamp + the re-read link, in one quiet line. */
export function ReportFreshness({ href, nowMs }: { href: string; nowMs: number }) {
  return (
    <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
      Read at {asOfLabel(nowMs)} Pacific. Reporting results may be cached for up to 10 minutes.{' '}
      <Link href={href} style={{ color: 'var(--a-accent)' }}>
        Read again
      </Link>
    </p>
  )
}

// ── Error (the read failed — say so, and offer the retry) ─────────────────────

/**
 * The legacy pages caught a failed read and rendered zeros, which reads as
 * "nothing happened this period". A broker acts on these figures, so a failed
 * read has to look different from an empty one (§0).
 */
export function ReportError({ what, href }: { what: string; href: string }) {
  return (
    <p
      style={{
        fontSize: 'var(--a-text-sm)',
        color: 'var(--a-danger)',
        margin: '0 0 20px',
      }}
    >
      {what} could not be read just now — the figures below are not a measurement.{' '}
      <Link href={href} style={{ color: 'var(--a-accent)' }}>
        Try the read again
      </Link>
    </p>
  )
}

// ── Loading skeleton (rendered from each route's loading.tsx) ─────────────────

export function ReportSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="av2-scope" style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <div className="av2-rskel" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="av2-rskel__row"
            style={{ width: i === 0 ? '46%' : i % 3 === 0 ? '72%' : '88%' }}
          />
        ))}
      </div>
      <p className="av2-sysnote" style={{ paddingTop: 8 }} role="status">
        Reading the report…
      </p>
    </div>
  )
}
