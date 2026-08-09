'use client'

/**
 * ProspectPriceHistory — the prior-MLS-cycle list for the review detail
 * (spec 07 §2 detail content). Mobile renders stacked mini-rows; desktop
 * renders the admin's ONE tabular reader inside its own scroll box — per
 * CLAUDE.md this is the ONE place a small table may scroll internally; the page
 * body itself never scrolls horizontally.
 *
 * 11F: on the LOCKED admin v2 language. The shadcn <Table> became <ReportGrid>
 * (the admin's one tabular reader) and the shadcn <Card> became a hairline
 * surface; every figure, every string and underContractStory's rules are
 * untouched. ONE shape change, and it is the one ReportGrid cannot express: the
 * fall-through story used to be its own colSpan={7} row under its cycle, and a
 * ReportGrid row carries one cell per column with no span. It is now the second
 * line of that cycle's Status cell, which is where it belongs anyway — it
 * qualifies the status ("Expired · went pending after 45 days, fell through").
 * Nothing is dropped and no row moved to a different cycle.
 */

import { ReportGrid, type ReportColumn } from '@/components/admin/v2'
import type { ProspectPriceCycle } from '@/lib/data/prospecting/types'
import { formatDate, formatPrice } from './format'

/** Statuses where a cycle is still in flight — no fall-through claim allowed. */
const IN_FLIGHT_STATUSES = ['Active', 'Pending', 'Active Under Contract', 'Coming Soon']

/**
 * The under-contract story for one cycle, from days_to_pending +
 * back_on_market_count. Returns null when the data shows no fall-through
 * (a clean list → close, a cycle that never went pending, or a cycle still
 * in flight) — the line only renders when the source columns prove it.
 */
export function underContractStory(cycle: ProspectPriceCycle): string | null {
  const boms = cycle.backOnMarketCount ?? 0
  if (cycle.daysToPending == null && boms === 0) return null

  const times = boms === 1 ? 'once' : `${boms} times`
  if (cycle.closePrice != null) {
    // Eventually closed — only a story when a contract fell through first.
    if (boms === 0) return null
    return cycle.daysToPending != null
      ? `Went pending after ${cycle.daysToPending} days, fell through ${times} before closing`
      : `Fell out of contract ${times} before closing`
  }

  if (IN_FLIGHT_STATUSES.includes(cycle.status ?? '')) return null
  const base =
    cycle.daysToPending != null
      ? `Went pending after ${cycle.daysToPending} days, fell through`
      : 'Went under contract, fell through'
  return boms > 1 ? `${base} (back on market ${boms} times)` : base
}

const COLUMNS: ReportColumn[] = [
  { key: 'listDate', label: 'List date' },
  { key: 'status', label: 'Status' },
  { key: 'originalList', label: 'Original list', numeric: true },
  { key: 'finalList', label: 'Final list', numeric: true },
  { key: 'close', label: 'Close', numeric: true },
  { key: 'dom', label: 'DOM', numeric: true },
  { key: 'drops', label: 'Drops', numeric: true },
]

const storyStyle = { fontSize: 'var(--a-text-xs)', fontWeight: 500, color: 'var(--a-warn)' } as const

export function ProspectPriceHistory({ cycles }: { cycles: ProspectPriceCycle[] }) {
  if (cycles.length === 0) {
    return (
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
        No prior MLS listing history on file.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Phones — stacked mini-rows, one per cycle. */}
      <div className="space-y-2 sm:hidden">
        {cycles.map((cycle, i) => {
          const story = underContractStory(cycle)
          return (
          <div
            key={`${cycle.listDate ?? 'cycle'}-${i}`}
            style={{
              minWidth: 0,
              padding: 'var(--a-s3)',
              fontSize: 'var(--a-text-sm)',
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-lg)',
              background: 'var(--a-surface)',
              color: 'var(--a-text)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>{formatDate(cycle.listDate)}</span>
              <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{cycle.status ?? '—'}</span>
            </div>
            <div
              className="mt-1.5 flex items-baseline justify-between gap-2"
              style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
            >
              <span>List</span>
              <span className="a-num" style={{ color: 'var(--a-text)' }}>
                {formatPrice(cycle.originalListPrice)}
                {cycle.finalListPrice != null && cycle.finalListPrice !== cycle.originalListPrice
                  ? ` → ${formatPrice(cycle.finalListPrice)}`
                  : ''}
              </span>
            </div>
            {cycle.closePrice != null ? (
              <div
                className="flex items-baseline justify-between gap-2"
                style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                <span>Closed</span>
                <span className="a-num" style={{ color: 'var(--a-text)' }}>
                  {formatPrice(cycle.closePrice)}
                </span>
              </div>
            ) : null}
            <div
              className="mt-1 flex items-baseline justify-between gap-2"
              style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
            >
              <span>Days on market · Price drops</span>
              <span className="a-num">
                {cycle.daysOnMarket ?? '—'} · {cycle.priceDropCount ?? 0}
              </span>
            </div>
            {story ? (
              <p className="mt-1" style={storyStyle}>
                {story}
              </p>
            ) : null}
          </div>
          )
        })}
      </div>

      {/* Desktop — the one tabular reader, scrolling inside its own box only. */}
      <div className="hidden sm:block" style={{ minWidth: 0 }}>
        <ReportGrid
          label="Price history"
          columns={COLUMNS}
          template="minmax(96px, 1fr) minmax(180px, 1.9fr) repeat(3, minmax(92px, 1fr)) minmax(60px, 0.7fr) minmax(60px, 0.7fr)"
          minWidth={720}
          empty="No prior MLS listing history on file."
          rows={cycles.map((cycle, i) => {
            const story = underContractStory(cycle)
            return {
              key: `${cycle.listDate ?? 'cycle'}-${i}`,
              cells: [
                formatDate(cycle.listDate),
                <span key="status">
                  {cycle.status ?? '—'}
                  {story ? <span style={{ ...storyStyle, display: 'block' }}>{story}</span> : null}
                </span>,
                formatPrice(cycle.originalListPrice),
                formatPrice(cycle.finalListPrice),
                formatPrice(cycle.closePrice),
                cycle.daysOnMarket ?? '—',
                cycle.priceDropCount ?? 0,
              ],
            }
          })}
        />
      </div>
    </div>
  )
}
