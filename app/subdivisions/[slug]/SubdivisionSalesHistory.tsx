/**
 * SubdivisionSalesHistory — yearly closed COUNT on /subdivisions/[slug].
 *
 * Two populations live on this route and they are not the same:
 *   - This table: get_subdivision_sales_history. MLS SubdivisionName slug-join,
 *     PropertyType A (single-family). Calendar-year closed counts.
 *   - PublicSubdivisionCounts: recorded-plat membership (place_membership
 *     is_primary). 12-month closed_count stays on that strip.
 *
 * market_stats_cache soldCount is the same MLS-name family as this table, YTD,
 * not membership closed_count. Omit it here so it cannot be read as the
 * recorded-plat 12-month closed count. Median days on market from that cache
 * row may still open the band. Closed-sale prices stay behind
 * publishSubdivisionClosedPrice (REGISTRY §4).
 *
 * ODS §5-4 A.4: counts only, never individual sold addresses or prices.
 * Renders null when there is no history AND no remaining stats cell.
 */

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import type { MarketStats } from '@/lib/data'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { publishSubdivisionClosedPrice } from '@/lib/market/publish-subdivision-closed-price'
import {
  HISTORY_MAX_YEAR,
  HISTORY_MIN_YEAR,
  historyYearHref,
  splitByExplorerRange,
} from './_v3/history-door'

const MAX_YEAR_ROWS = 40

const PERIOD_LABEL: Record<MarketStats['periodType'], string> = {
  rolling_30d: 'Last 30 days',
  rolling_90d: 'Last 90 days',
  rolling_365d: 'Last 12 months',
  monthly: 'This month',
  ytd: 'Year to date',
}

/** Public grain line for the yearly table. Not recorded-plat membership. */
export const SUBDIVISION_YEARLY_HISTORY_NOTE =
  'MLS plat-name closed counts. Single-family name join. This grain does not publish a median price.'

export type SubdivisionStatCell = { label: string; value: string }

/**
 * Cache-row cells that may print next to the yearly MLS table.
 * soldCount stays off: it is MLS-name YTD, not recorded-plat 12-month closed.
 */
export function subdivisionCacheStatCells(stats: MarketStats | null): SubdivisionStatCell[] {
  if (!stats) return []
  const cells: SubdivisionStatCell[] = []
  const publishedMedian = publishSubdivisionClosedPrice(stats.medianSalePrice)
  if (publishedMedian != null) {
    cells.push({
      label: 'Closed median',
      value: `$${Math.round(publishedMedian).toLocaleString('en-US')}`,
    })
  }
  if (stats.medianDaysOnMarket != null) {
    cells.push({
      label: 'Median days on market',
      value: `${Math.round(stats.medianDaysOnMarket)} days`,
    })
  }
  const publishedYoy = publishSubdivisionClosedPrice(stats.yoyChangePct)
  if (publishedYoy != null) {
    const arrow = publishedYoy > 0 ? '↑' : publishedYoy < 0 ? '↓' : '→'
    cells.push({
      label: 'Closed median YoY',
      value: `${arrow} ${Math.abs(publishedYoy).toFixed(1)}% YoY`,
    })
  }
  return cells
}

interface Props {
  displayName: string
  history: SubdivisionSalesYear[]
  stats: MarketStats | null
  cityName: string
  /**
   * The chart-room cards for this plat (SubdivisionMarketCharts), mounted
   * inside this section so the page keeps ONE market section. Passed as a
   * node because this component is synchronous and the charts read the DAL.
   */
  charts?: ReactNode
}

export function SubdivisionSalesHistory({ displayName, history, stats, cityName, charts }: Props) {
  const hasHistory = history.length > 0
  const statCells = subdivisionCacheStatCells(stats)
  if (!hasHistory && statCells.length === 0) return null

  const { openable, outsideClosed, outsideYears } = splitByExplorerRange(history)
  const totalClosed = history.reduce((sum, r) => sum + r.closedCount, 0)
  const firstYear = hasHistory ? history[history.length - 1].year : null
  const rows = openable.slice(0, MAX_YEAR_ROWS)
  const outsideBit =
    outsideClosed === 1 ? '1 closing' : `${outsideClosed.toLocaleString('en-US')} closings`
  const outsideYearBit = outsideYears === 1 ? 'one year' : `${outsideYears} years`

  const cellPad = '12px 16px'
  const numCell: CSSProperties = {
    padding: cellPad,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }

  return (
    <section className="section" id="sales-history" aria-label="Sales history">
      <div className="wrap">
        <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
          <span className="sec-index">{displayName} {'·'} Sales history</span>
          <h2 className="sec-title display">Sales history</h2>
        </div>

        {hasHistory ? (
          <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--navy-70)', maxWidth: '42rem', margin: '0 0 1.5rem' }}>
            {totalClosed.toLocaleString('en-US')} single-family {totalClosed === 1 ? 'home has' : 'homes have'} closed under the MLS plat name {displayName}
            {firstYear != null ? ` since ${firstYear}` : ''}.
          </p>
        ) : null}

        {stats && statCells.length > 0 ? (
          <div style={{ margin: '0 0 2rem' }}>
            <p className="eyebrow" style={{ margin: '0 0 .75rem' }}>
              {PERIOD_LABEL[stats.periodType]}
            </p>
            <dl
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '2rem',
                margin: 0,
              }}
            >
              {statCells.map((cell) => (
                <div key={cell.label}>
                  <dt style={{ fontSize: '.72rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--navy-70)' }}>
                    {cell.label}
                  </dt>
                  <dd style={{ margin: '.25rem 0 0', fontSize: '1.4rem', fontVariantNumeric: 'tabular-nums' }}>
                    {cell.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {charts}

        {hasHistory ? (
          <div style={{ overflowX: 'auto', marginTop: '2rem' }}>
            <table
              style={{
                width: '100%',
                maxWidth: '42rem',
                borderCollapse: 'collapse',
                fontSize: '.95rem',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid var(--navy)' }}>
                  <th scope="col" style={{ padding: cellPad, textAlign: 'left', fontWeight: 600 }}>
                    Year
                  </th>
                  <th scope="col" style={{ padding: cellPad, textAlign: 'right', fontWeight: 600 }}>
                    Closed sales
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} style={{ borderBottom: '1px solid rgba(16,39,66,0.08)' }}>
                    <td style={{ padding: cellPad, fontVariantNumeric: 'tabular-nums' }}>
                      <Link
                        href={historyYearHref(r.year, cityName)}
                        style={{ color: 'var(--navy)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}
                      >
                        {r.year}
                      </Link>
                    </td>
                    <td style={numCell}>{r.closedCount.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p style={{ fontSize: '.8rem', color: 'var(--navy-70)', margin: '1.25rem 0 0', maxWidth: '42rem' }}>
          {SUBDIVISION_YEARLY_HISTORY_NOTE}
          {outsideYears > 0
            ? ` ${outsideBit} across ${outsideYearBit} sit outside the closed-sales explorer (from ${HISTORY_MIN_YEAR} to ${HISTORY_MAX_YEAR}) and are counted above, not linked.`
            : ''}{' '}
          Source: Oregon Data Share via Ryan Realty.
        </p>
      </div>
    </section>
  )
}
