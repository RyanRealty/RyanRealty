'use client'

import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type Stats = {
  medianPrice: number | null
  count: number
  avgDom: number | null
  closedLast12Months: number
}

type PricePoint = { month: string; medianPrice: number }

type Props = {
  cityName: string
  slug: string
  stats: Stats
  priceHistory: PricePoint[]
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatMonth(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export default function CityMarketStats({
  cityName,
  slug,
  stats,
  priceHistory,
}: Props) {
  const hasChartData = priceHistory.length >= 2

  return (
    <section className="bg-[var(--brand-cream)] px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="city-market-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="city-market-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
          {cityName} Market Overview
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-[var(--brand-navy)]">{formatPrice(stats.medianPrice)}</p>
            <p className="text-sm text-[var(--text-secondary)]">Median Price</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-[var(--brand-navy)]">{stats.count}</p>
            <p className="text-sm text-[var(--text-secondary)]">Active Listings</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-[var(--brand-navy)]">
              {stats.avgDom != null && stats.avgDom > 0 ? Math.round(stats.avgDom) : '—'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">Avg Days on Market</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-[var(--brand-navy)]">{stats.closedLast12Months}</p>
            <p className="text-sm text-[var(--text-secondary)]">Homes Sold (12 mo)</p>
          </div>
        </div>
        {hasChartData ? (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-[var(--brand-navy)]">Median price trend</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory.map((p) => ({ ...p, monthLabel: formatMonth(p.month) }))}>
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => [formatPrice(v), 'Median']} labelFormatter={formatMonth} />
                  <Line type="monotone" dataKey="medianPrice" stroke="var(--brand-navy)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="mt-8 text-[var(--text-secondary)]">
            Market data building — check back soon for price trends.
          </p>
        )}
        <div className="mt-8">
          <Link
            href={`/reports?city=${encodeURIComponent(slug)}`}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-6 py-3 font-semibold text-[var(--brand-navy)] hover:bg-[var(--accent-hover)]"
          >
            Download Full Market Report
          </Link>
        </div>
      </div>
    </section>
  )
}
