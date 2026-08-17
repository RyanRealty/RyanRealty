/**
 * SubdivisionSalesHistory — the sales-history depth section on
 * /subdivisions/[slug] (W2.5): yearly closed-sale aggregates from the 589K-row
 * historical archive, plus the per-subdivision market-stats strip when
 * market_stats_cache carries a geo_type='subdivision' row.
 *
 * §0 sources (both are one cached DAL read, query shape documented in the DAL):
 *   - history: getSubdivisionSalesHistory -> get_subdivision_sales_history RPC
 *     (server-side GROUP BY year over closed SFR sales for this plat slug).
 *   - stats: getMarketStats geoType='subdivision' -> market_stats_cache row
 *     (6h freshness; null for most plats until the cache backfill lands).
 *
 * ODS §5-4 A.4: renders ONLY aggregate market statistics (year, count,
 * median). Never individual sold addresses or prices — sold listing data is
 * VOW-only. §7-3: the section carries the ODS source line.
 *
 * Renders null when there is no history AND no stats row (fails soft until the
 * sales-history migration is applied).
 */

import type { CSSProperties } from 'react'
import Link from 'next/link'
import type { MarketStats } from '@/lib/data'
import type { SubdivisionSalesYear } from '@/lib/data/subdivisions/getSubdivisionSalesHistory'
import { currentYearSalesRow, publishPlatYtdStats } from '@/lib/market/publish-plat-year-sales'
import {
  HISTORY_MAX_YEAR,
  HISTORY_MIN_YEAR,
  historyYearHref,
  splitByExplorerRange,
} from './_v3/history-door'

const MAX_YEAR_ROWS = 40

/** $894,750 -> "$895,000" (brand rule: currency rounded to the nearest thousand). */
function currencyRounded(value: number): string {
  return `$${(Math.round(value / 1000) * 1000).toLocaleString('en-US')}`
}

/** One-decimal signed YoY pill text per brand rules: "↑ 2.1% YoY". */
function yoyText(pct: number): string {
  const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→'
  return `${arrow} ${Math.abs(pct).toFixed(1)}% YoY`
}

const PERIOD_LABEL: Record<MarketStats['periodType'], string> = {
  rolling_30d: 'Last 30 days',
  rolling_90d: 'Last 90 days',
  rolling_365d: 'Last 12 months',
  monthly: 'This month',
  ytd: 'Year to date',
}

interface Props {
  displayName: string
  history: SubdivisionSalesYear[]
  stats: MarketStats | null
  cityName: string
}

export function SubdivisionSalesHistory({ displayName, history, stats, cityName }: Props) {
  const publishedStats = publishPlatYtdStats({
    stats,
    currentYear: currentYearSalesRow(history),
  })
  const hasHistory = history.length > 0
  const hasStats = Boolean(
    publishedStats && (publishedStats.medianSalePrice != null || publishedStats.soldCount != null),
  )
  if (!hasHistory && !hasStats) return null

  const { openable, outsideClosed, outsideYears } = splitByExplorerRange(history)
  const totalClosed = history.reduce((sum, r) => sum + r.closedCount, 0)
  const firstYear = hasHistory ? history[history.length - 1].year : null
  const rows = openable.slice(0, MAX_YEAR_ROWS)
  const outsideBit =
    outsideClosed === 1 ? '1 closing' : `${outsideClosed.toLocaleString('en-US')} closings`
  const outsideYearBit = outsideYears === 1 ? 'one year' : `${outsideYears} years`

  const statCells: Array<{ label: string; value: string }> = []
  if (publishedStats) {
    if (publishedStats.medianSalePrice != null) {
      statCells.push({ label: 'Median sale price', value: currencyRounded(publishedStats.medianSalePrice) })
    }
    if (publishedStats.medianDaysOnMarket != null) {
      statCells.push({
        label: 'Median days on market',
        value: `${Math.round(publishedStats.medianDaysOnMarket)} days`,
      })
    }
    if (publishedStats.soldCount != null) {
      statCells.push({ label: 'Homes sold', value: String(publishedStats.soldCount) })
    }
    if (publishedStats.yoyChangePct != null) {
      statCells.push({ label: 'Median price', value: yoyText(publishedStats.yoyChangePct) })
    }
  }

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
            {totalClosed.toLocaleString('en-US')} single-family {totalClosed === 1 ? 'home has' : 'homes have'} closed in {displayName}
            {firstYear != null ? ` since ${firstYear}` : ''}.
          </p>
        ) : null}

        {hasStats && publishedStats && statCells.length > 0 ? (
          <div style={{ margin: '0 0 2rem' }}>
            <p className="eyebrow" style={{ margin: '0 0 .75rem' }}>
              {PERIOD_LABEL[publishedStats.periodType]}
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

        {hasHistory ? (
          <div style={{ overflowX: 'auto' }}>
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
                  <th scope="col" style={{ padding: cellPad, textAlign: 'right', fontWeight: 600 }}>
                    Median close price
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
                    {/* Em-dash below is the standard unavailable-data placeholder, allowed by the brand rules. */}
                    <td style={numCell}>
                      {r.medianClosePrice != null ? currencyRounded(r.medianClosePrice) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p style={{ fontSize: '.8rem', color: 'var(--navy-70)', margin: '1.25rem 0 0', maxWidth: '42rem' }}>
          Single-family homes. Median prices rounded to the nearest thousand.
          {outsideYears > 0
            ? ` ${outsideBit} across ${outsideYearBit} sit outside the closed-sales explorer (from ${HISTORY_MIN_YEAR} to ${HISTORY_MAX_YEAR}) and are counted above, not linked.`
            : ''}{' '}
          Source: Oregon Data Share via Ryan Realty.
        </p>
      </div>
    </section>
  )
}
