'use client'

import { useState } from 'react'
import {
  getReportMetrics,
  getReportPriceBands,
  type ReportMetrics,
  type ReportPriceBandsResult,
} from '../../actions/reports'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toYMD(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

function monthBounds(year: number, month1Based: number): { start: string; end: string } {
  const start = new Date(year, month1Based - 1, 1)
  const end = new Date(year, month1Based, 0)
  return { start: toYMD(start), end: toYMD(end) }
}

function quarterBounds(year: number, quarter: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const start = new Date(year, startMonth - 1, 1)
  const end = new Date(year, startMonth + 2, 0)
  return { start: toYMD(start), end: toYMD(end) }
}

export default function CityReportSection({ cities }: { cities: string[] }) {
  const now = new Date()
  const [city, setCity] = useState('')
  const [periodType, setPeriodType] = useState<'month' | 'quarter'>('month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1)
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null)
  const [priceBands, setPriceBands] = useState<ReportPriceBandsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [periodLabel, setPeriodLabel] = useState('')

  async function handleGenerate() {
    const c = city.trim()
    if (!c) {
      setError('Pick a city')
      return
    }
    setError(null)
    setMetrics(null)
    setPriceBands(null)
    setLoading(true)
    try {
      const { start, end } =
        periodType === 'month'
          ? monthBounds(year, month)
          : quarterBounds(year, quarter)
      const label =
        periodType === 'month'
          ? `${MONTHS[month - 1]} ${year}`
          : `Q${quarter} ${year}`
      setPeriodLabel(label)

      const [metricsRes, bandsRes] = await Promise.all([
        getReportMetrics(c, start, end),
        getReportPriceBands(c, start, end),
      ])
      if (metricsRes.error) {
        setError(metricsRes.error)
        return
      }
      if (bandsRes.error) {
        setError(bandsRes.error)
        return
      }
      setMetrics(metricsRes.data ?? null)
      setPriceBands(bandsRes.data ?? null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-12 border-t border-zinc-200 pt-10">
      <h2 className="text-xl font-semibold text-zinc-900">Report by city & period</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Metrics by city and period (SFR only): sold count, median price, median DOM, median $/sqft, current listings, 12mo sales, inventory. Price bands for sales and current listings.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">City</span>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Period</span>
          <select
            value={periodType}
            onChange={(e) => setPeriodType(e.target.value as 'month' | 'quarter')}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
          >
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
          </select>
        </label>
        {periodType === 'month' ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Month</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Year</span>
              <input
                type="number"
                min={2000}
                max={2030}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
              />
            </label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Quarter</span>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>Q{q}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-700">Year</span>
              <input
                type="number"
                min={2000}
                max={2030}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24 rounded border border-zinc-300 bg-white px-3 py-2 text-zinc-900"
              />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Generate report'}
        </button>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      )}
      {(metrics !== null || priceBands !== null) && (
        <div className="mt-6 space-y-6">
          {periodLabel && (
            <p className="text-sm font-medium text-zinc-700">
              {city} — {periodLabel}
            </p>
          )}
          {metrics !== null && (
            <div className="overflow-x-auto">
              <table className="min-w-[320px] border border-zinc-200 text-sm">
                <tbody>
                  <tr><td className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium"># Sales (period)</td><td className="border border-zinc-200 px-3 py-2">{metrics.sold_count}</td></tr>
                  <tr><td className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">Median price</td><td className="border border-zinc-200 px-3 py-2">${Number(metrics.median_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td></tr>
                  <tr><td className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">Median DOM</td><td className="border border-zinc-200 px-3 py-2">{metrics.median_dom} days</td></tr>
                  <tr><td className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">Median $/sqft</td><td className="border border-zinc-200 px-3 py-2">${Number(metrics.median_ppsf).toLocaleString('en-US', { maximumFractionDigits: 2 })}</td></tr>
                  <tr><td className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">Current listings</td><td className="border border-zinc-200 px-3 py-2">{metrics.current_listings}</td></tr>
                  <tr><td className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">Sales (prior 12 mo)</td><td className="border border-zinc-200 px-3 py-2">{metrics.sales_12mo}</td></tr>
                  <tr><td className="border border-zinc-200 bg-zinc-50 px-3 py-2 font-medium">Inventory (months)</td><td className="border border-zinc-200 px-3 py-2">{metrics.inventory_months ?? '—'}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {priceBands && (priceBands.sales_by_band?.length > 0 || priceBands.current_listings_by_band?.length > 0) && (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-800">Sales by price band</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {(priceBands.sales_by_band ?? []).map((b) => (
                    <li key={b.band} className="flex justify-between gap-4">
                      <span className="text-zinc-600">{b.band}</span>
                      <span className="font-medium">{b.cnt}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-800">Current listings by price band</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {(priceBands.current_listings_by_band ?? []).map((b) => (
                    <li key={b.band} className="flex justify-between gap-4">
                      <span className="text-zinc-600">{b.band}</span>
                      <span className="font-medium">{b.cnt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
