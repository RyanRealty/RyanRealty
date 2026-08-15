import { V3Chart, v3Text } from '@/components/site/v3'
import type { ReportListing } from '@/app/actions/market-reports'

const PRICE_BANDS = [
  { min: 0, max: 300, label: '$0-300K' },
  { min: 300, max: 400, label: '$300-400K' },
  { min: 400, max: 500, label: '$400-500K' },
  { min: 500, max: 600, label: '$500-600K' },
  { min: 600, max: 700, label: '$600-700K' },
  { min: 700, max: 800, label: '$700-800K' },
  { min: 800, max: 1000, label: '$800K-1M' },
  { min: 1000, max: 99999, label: '$1M+' },
] as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

type Props = {
  closed: ReportListing[]
  periodStart: Date
  periodEnd: Date
}

function utcYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function shortDay(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number)
  if (!year || !month || !day) return ymd
  return `${MONTHS[month - 1]} ${day}`
}

export function buildPriceBandData(closed: ReportListing[]) {
  const counts = PRICE_BANDS.map((b) => ({ ...b, count: 0, name: b.label }))
  for (const item of closed) {
    const p = item.price
    if (p == null || !Number.isFinite(p)) continue
    const priceK = p / 1000
    const i = PRICE_BANDS.findIndex((b) => priceK >= b.min && priceK < b.max)
    if (i >= 0) counts[i]!.count += 1
  }
  return counts
}

export function buildSalesByDayData(closed: ReportListing[], periodStart: Date, periodEnd: Date) {
  const byDay = new Map<string, number>()
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    byDay.set(utcYmd(d), 0)
  }
  for (const item of closed) {
    const ed = item.event_date
    if (!ed) continue
    const key = ed.includes('T') ? ed.slice(0, 10) : ed
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, short: shortDay(date), count }))
}

export function buildDomData(closed: ReportListing[]) {
  const buckets = [
    { name: '0-30', min: 0, max: 30, count: 0 },
    { name: '31-60', min: 31, max: 60, count: 0 },
    { name: '61-90', min: 61, max: 90, count: 0 },
    { name: '91-180', min: 91, max: 180, count: 0 },
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

function countSeries(
  name: string,
  rows: readonly { name?: string; short?: string; count: number }[],
  tickOf: (row: { name?: string; short?: string }) => string,
) {
  return [
    {
      name: v3Text(name),
      points: rows.map((row) => ({
        value: row.count,
        tick: v3Text(tickOf(row)),
        label: v3Text(`${row.count} sold`),
      })),
    },
  ]
}

export default function SalesReportCharts({ closed, periodStart, periodEnd }: Props) {
  const priceBandData = buildPriceBandData(closed)
  const salesByDayData = buildSalesByDayData(closed, periodStart, periodEnd)
  const domData = buildDomData(closed)
  const hasSales = salesByDayData.some((d) => d.count > 0)
  const hasPrice = priceBandData.some((d) => d.count > 0)
  const hasDom = domData.some((d) => d.count > 0)

  return (
    <div className="mt-12 space-y-12">
      {hasSales ? (
        <V3Chart
          id="sales-by-day"
          caption={v3Text('Sales by day')}
          kind="line"
          series={countSeries('Sales', salesByDayData, (row) => row.short ?? row.name ?? 'day')}
        />
      ) : null}

      {hasPrice ? (
        <V3Chart
          id="sales-price-bands"
          caption={v3Text('Price distribution')}
          kind="bars"
          baselineLabel={v3Text('0')}
          series={countSeries('Sales', priceBandData, (row) => row.name ?? 'band')}
        />
      ) : null}

      {hasDom ? (
        <V3Chart
          id="sales-dom"
          caption={v3Text('Days on market')}
          kind="bars"
          baselineLabel={v3Text('0')}
          series={countSeries('Sales', domData, (row) => row.name ?? 'days')}
        />
      ) : null}
    </div>
  )
}
