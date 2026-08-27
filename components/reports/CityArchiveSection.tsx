/**
 * CityArchiveSection — the per-year decade table on /housing-market/reports/archive/[city]
 * (W8.5). Renders a CityArchive (from getCityArchive) as aggregate market
 * statistics only.
 *
 * §0 / ODS §5-4 A.4: aggregate figures only — closed-sale COUNT per year and the
 * RANGE of that year's volume-qualifying monthly medians. Never an individual
 * sold address or price. The price column is a range, never a fabricated single
 * "annual median" (a median of monthly medians is not a true annual median).
 *
 * The most recent year is flagged when partial (fewer than 12 months in the
 * cache) so a mid-year count is never read as a full-year total.
 *
 * KB design register (raw HTML + KB inline styles), matching the sibling
 * SubdivisionSalesHistory sales table — new site surfaces use the KB system, not
 * shadcn (ci:shadcn-burndown). Listed in .design-token-lint-ignore for the same
 * reason SubdivisionSalesHistory's aggregate table is baselined.
 */

import type { CSSProperties } from 'react'
import type { CityArchive } from '@/lib/data/market/getCityArchive'

const cellPad = '12px 16px'

/** $765,835.50 -> "$766,000" (brand rule: currency rounded to the nearest thousand). */
function currencyRounded(value: number): string {
  return `$${(Math.round(value / 1000) * 1000).toLocaleString('en-US')}`
}

/** The year's price cell: a low–high range of monthly medians, or the unavailable dash. */
function priceRange(low: number | null, high: number | null): string {
  if (low == null || high == null) return '—'
  if (Math.round(low / 1000) === Math.round(high / 1000)) return currencyRounded(low)
  return `${currencyRounded(low)} – ${currencyRounded(high)}`
}

export function CityArchiveSection({ archive }: { archive: CityArchive }) {
  const yearsWithSales = archive.years.filter((y) => y.homesSold > 0)
  if (yearsWithSales.length === 0) {
    return (
      <section className="section" id="archive" aria-label="Market archive">
        <div className="wrap">
          <p style={{ color: 'var(--v3-ink-muted)', fontSize: '1.05rem', maxWidth: '42rem' }}>
            No closed single-family sales are on record for {archive.label} in the archive window.
          </p>
        </div>
      </section>
    )
  }

  const span =
    archive.earliestYear != null && archive.latestYear != null && archive.earliestYear !== archive.latestYear
      ? `${archive.earliestYear} to ${archive.latestYear}`
      : String(archive.latestYear ?? archive.earliestYear ?? '')

  const numCell: CSSProperties = {
    padding: cellPad,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }

  return (
    <section className="section" id="archive" aria-label="Market archive">
      <div className="wrap">
        <div className="sec-head" style={{ borderColor: 'var(--v3-navy)' }}>
          <span className="sec-index">{archive.label} {'·'} Market archive</span>
          <h2 className="sec-title display">Sales by year</h2>
        </div>

        <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--v3-ink-muted)', maxWidth: '42rem', margin: '0 0 1.5rem' }}>
          {archive.totalSold.toLocaleString('en-US')} single-family {archive.totalSold === 1 ? 'home has' : 'homes have'} closed in {archive.label} from {span}. The price column shows the range of monthly median sale prices within each year.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', maxWidth: '44rem', borderCollapse: 'collapse', fontSize: '.95rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--v3-navy)' }}>
                <th scope="col" style={{ padding: cellPad, textAlign: 'left', fontWeight: 600 }}>Year</th>
                <th scope="col" style={{ padding: cellPad, textAlign: 'right', fontWeight: 600 }}>Homes sold</th>
                <th scope="col" style={{ padding: cellPad, textAlign: 'right', fontWeight: 600 }}>Median sale price</th>
              </tr>
            </thead>
            <tbody>
              {yearsWithSales.map((y) => {
                const partial = y.complete ? null : (
                  <span style={{ color: 'var(--v3-ink-muted)', fontSize: '.78rem', marginLeft: '.5rem' }}>
                    (through {y.monthsPresent} {y.monthsPresent === 1 ? 'month' : 'months'})
                  </span>
                )
                return (
                  <tr key={y.year} style={{ borderBottom: '1px solid color-mix(in srgb, var(--v3-navy) 8%, transparent)' }}>
                    <td style={{ padding: cellPad, fontVariantNumeric: 'tabular-nums' }}>
                      {y.year}
                      {partial}
                    </td>
                    <td style={numCell}>{y.homesSold.toLocaleString('en-US')}</td>
                    {/* Em-dash is the standard unavailable-data placeholder (brand rule). */}
                    <td style={numCell}>{priceRange(y.medianLow, y.medianHigh)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: '.8rem', color: 'var(--v3-ink-muted)', margin: '1.25rem 0 0', maxWidth: '44rem' }}>
          Single-family homes. Homes sold is the count of closed sales each year. The price range shows the lowest and highest monthly median sale price within the year, over months with enough closings to report a reliable median. Prices rounded to the nearest thousand. Source: Oregon Data Share via Ryan Realty.
        </p>
      </div>
    </section>
  )
}
