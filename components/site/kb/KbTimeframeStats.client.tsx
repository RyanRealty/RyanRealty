'use client'

/**
 * KbTimeframeStats — the W8.4 timeframe selector on the canonical
 * /housing-market/[geo] report. Defaults to Year to date; the reader switches
 * to This month or Last 12 months without a page load.
 *
 * §0: every figure is a pre-fetched market_stats_cache field (getCityMarketDetail
 * per period) passed in from the server — this component only formats and swaps,
 * it never computes or fetches. A period with no cache row shows the em-dash
 * placeholder, never a fabricated number.
 */

import { useState } from 'react'
import type { MarketDetail } from '@/lib/data'

export type TimeframeKey = 'ytd' | 'monthly' | 'rolling_365d'

const TABS: Array<{ key: TimeframeKey; label: string }> = [
  { key: 'ytd', label: 'Year to date' },
  { key: 'monthly', label: 'This month' },
  { key: 'rolling_365d', label: 'Last 12 months' },
]

function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}
function usdSqft(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '—' : `$${Math.round(n).toLocaleString('en-US')}`
}
function days(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '—' : `${Math.round(n)} days`
}
function int(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US')
}
/** avg_sale_to_list_ratio is a fraction (0.9697); ×100 for the percent. */
function pctFromRatio(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(1)}%`
}
/** Signed-arrow YoY. */
function yoy(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  if (Math.abs(n) < 0.05) return 'about level'
  return `${n > 0 ? '↑' : '↓'} ${Math.abs(n).toFixed(1)}% YoY`
}

export function KbTimeframeStats({
  cityName,
  periods,
  initial = 'ytd',
}: {
  cityName: string
  periods: Partial<Record<TimeframeKey, MarketDetail | null>>
  initial?: TimeframeKey
}) {
  const [active, setActive] = useState<TimeframeKey>(initial)
  const d = periods[active] ?? null

  const cells: Array<{ label: string; value: string }> = [
    { label: 'Median sale price', value: usd(d?.medianSalePrice) },
    { label: 'Homes sold', value: int(d?.soldCount) },
    { label: 'Median days on market', value: days(d?.medianDom) },
    { label: 'Price per sq ft', value: usdSqft(d?.medianPricePerSqft) },
    { label: 'Sale to list', value: pctFromRatio(d?.avgSaleToListRatio) },
    { label: 'Median price YoY', value: yoy(d?.yoyMedianPriceDeltaPct) },
    { label: 'Inventory', value: int(d?.endOfPeriodInventory) },
    { label: 'Market', value: d?.marketHealthLabel ?? '—' },
  ]

  return (
    <section className="section" id="timeframe" aria-label="Market by timeframe">
      <div className="wrap">
        <div className="sec-head" style={{ borderColor: 'var(--navy)' }}>
          <span className="sec-index">{cityName} {'·'} By timeframe</span>
          <h2 className="sec-title display">The numbers</h2>
        </div>

        <div role="tablist" aria-label="Timeframe" style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', margin: '0 0 1.5rem' }}>
          {TABS.map((t) => {
            const on = t.key === active
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => setActive(t.key)}
                style={{
                  padding: '8px 16px',
                  border: '2px solid var(--navy)',
                  borderRadius: '999px',
                  background: on ? 'var(--navy)' : 'transparent',
                  color: on ? 'var(--cream)' : 'var(--navy)',
                  fontWeight: 600,
                  fontSize: '.85rem',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <dl
          role="tabpanel"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))', gap: '1.5rem', margin: 0, maxWidth: '52rem' }}
        >
          {cells.map((c) => (
            <div key={c.label}>
              <dt style={{ fontSize: '.68rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--navy-70)' }}>{c.label}</dt>
              <dd style={{ margin: '.3rem 0 0', fontSize: '1.35rem', fontVariantNumeric: 'tabular-nums', color: 'var(--navy)' }}>{c.value}</dd>
            </div>
          ))}
        </dl>

        <p style={{ fontSize: '.8rem', color: 'var(--navy-70)', margin: '1.25rem 0 0', maxWidth: '52rem' }}>
          Single-family homes. Prices rounded to the nearest thousand. Source: Oregon Data Share via Ryan Realty.
        </p>
      </div>
    </section>
  )
}
