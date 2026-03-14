'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { ReportListing } from '@/app/actions/market-reports'

const PRICE_BANDS = [
  { min: 0, max: 300, label: '$0–300K' },
  { min: 300, max: 400, label: '$300–400K' },
  { min: 400, max: 500, label: '$400–500K' },
  { min: 500, max: 600, label: '$500–600K' },
  { min: 600, max: 700, label: '$600–700K' },
  { min: 700, max: 800, label: '$700–800K' },
  { min: 800, max: 1000, label: '$800K–1M' },
  { min: 1000, max: 99999, label: '$1M+' },
]

const CHART_COLORS = [
  'var(--primary)',
  'var(--accent)',
  'var(--primary / 0.18)',
  'var(--accent)',
  'var(--primary)',
  'var(--accent)',
  'var(--primary / 0.18)',
  'var(--accent)',
]

type Props = {
  closed: ReportListing[]
  periodStart: Date
  periodEnd: Date
}

/** Price distribution by band (count per band). */
function buildPriceBandData(closed: ReportListing[]) {
  const counts = PRICE_BANDS.map((b) => ({ ...b, count: 0, name: b.label }))
  for (const item of closed) {
    const p = item.price
    if (p == null || !Number.isFinite(p)) continue
    const priceK = p / 1000
    const band = PRICE_BANDS.find((b) => priceK >= b.min && priceK < b.max)
    if (band) {
      const i = PRICE_BANDS.indexOf(band)
      counts[i]!.count += 1
    }
  }
  return counts
}

/** Sales per day in period (for closed with event_date). */
function buildSalesByDayData(closed: ReportListing[], periodStart: Date, periodEnd: Date) {
  const byDay = new Map<string, number>()
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, 0)
  }
  for (const item of closed) {
    const ed = item.event_date
    if (!ed) continue
    const key = ed.includes('T') ? ed.slice(0, 10) : ed
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({
      date,
      short: new Date(date + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    }))
}

/** DOM distribution: buckets 0–30, 31–60, 61–90, 91–180, 181+. */
function buildDomData(closed: ReportListing[]) {
  const buckets = [
    { name: '0–30', min: 0, max: 30, count: 0 },
    { name: '31–60', min: 31, max: 60, count: 0 },
    { name: '61–90', min: 61, max: 90, count: 0 },
    { name: '91–180', min: 91, max: 180, count: 0 },
    { name: '181+', min: 181, max: 9999, count: 0 },
  ]
  for (const item of closed) {
    const dom = item.days_on_market
    if (dom == null || !Number.isFinite(dom)) continue
    const b = buckets.find((x) => dom >= x.min && dom <= x.max)
    if (b) b.count += 1
  }
  return buckets
}

export default function SalesReportCharts({ closed, periodStart, periodEnd }: Props) {
  const priceBandData = buildPriceBandData(closed)
  const salesByDayData = buildSalesByDayData(closed, periodStart, periodEnd)
  const domData = buildDomData(closed)
  const hasPrice = priceBandData.some((d) => d.count > 0)
  const hasDom = domData.some((d) => d.count > 0)

  return (
    <div className="mt-12 space-y-12">
      {salesByDayData.some((d) => d.count > 0) && (
        <div>
          <h3 className="text-lg font-bold text-primary">
            Sales by day
          </h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByDayData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="short"
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                  }}
                  labelStyle={{ color: 'var(--primary)' }}
                  formatter={(value: number) => [value, 'Sales']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? new Date(payload[0].payload.date + 'Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasPrice && (
        <div>
          <h3 className="text-lg font-bold text-primary">
            Price distribution
          </h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceBandData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                  }}
                  formatter={(value: number) => [value, 'Sales']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Sales">
                  {priceBandData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {hasDom && (
        <div>
          <h3 className="text-lg font-bold text-primary">
            Days on market
          </h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={domData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  label={{ value: 'Days', position: 'insideBottom', offset: -4, fill: 'var(--muted-foreground)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                  }}
                  formatter={(value: number) => [value, 'Sales']}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
