'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PriceHistoryPoint } from '@/lib/data/types/market'

/**
 * PriceChart.client — actual recharts AreaChart implementation for the
 * Layer 3 PriceChart block. Loaded lazily via next/dynamic from the
 * thin server-safe wrapper at components/site/PriceChart.tsx so the
 * recharts bundle does not weigh down first paint on routes that do
 * not render a chart.
 *
 * Visual: navy area + line, cream surface, sentence-case axis labels,
 * tabular-nums tooltip. Currency rounded to nearest $1k.
 *
 * Per CLAUDE.md §0 Data Accuracy: data MUST come from market_stats_cache
 * via getPriceHistory(). The chart never recomputes — it only renders
 * what was already aggregated and verified upstream.
 */

type Props = {
  data: ReadonlyArray<PriceHistoryPoint>
  /** Chart height in px. Default 280. */
  height?: number
}

function formatMonthShort(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'America/Los_Angeles' })
  } catch {
    return iso.slice(0, 7)
  }
}

function formatMoneyCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
  }
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`
  return `$${n}`
}

function formatMoneyFull(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const rounded = Math.round(n / 1000) * 1000
  return `$${rounded.toLocaleString('en-US')}`
}

type ChartDatum = {
  period: string
  median: number | null
  sold: number | null
  rawIso: string
}

export default function PriceChartClient({ data, height = 280 }: Props) {
  const chartData: ChartDatum[] = data.map((p) => ({
    period: formatMonthShort(p.periodStart),
    median: p.medianSalePrice ?? null,
    sold: p.soldCount ?? null,
    rawIso: p.periodStart,
  }))

  // Data-range y-axis. A $0 baseline flattens real 15-20% month-to-month swings
  // into a meaningless flat line. This is the industry-standard framing for a
  // price chart (Zillow / Redfin / FRED all do it), NOT a deceptive zoom: the
  // axis is fully labeled and the swings shown are genuinely this large. Padded
  // to round $25k bounds.
  const medians = chartData
    .map((d) => d.median)
    .filter((n): n is number => n != null && Number.isFinite(n))
  const dataMin = medians.length ? Math.min(...medians) : 0
  const dataMax = medians.length ? Math.max(...medians) : 0
  const pad = Math.max((dataMax - dataMin) * 0.2, 25000)
  const yLo = Math.max(0, Math.floor((dataMin - pad) / 25000) * 25000)
  const yHi = Math.ceil((dataMax + pad) / 25000) * 25000

  return (
    <div className="bg-card rounded-[14px] border border-border p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 16, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="rrPriceChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#102742" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#102742" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(16,39,66,0.08)" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fill: 'rgb(16 39 66 / 0.6)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(16,39,66,0.12)' }}
          />
          <YAxis
            domain={[yLo, yHi]}
            tickFormatter={(v) => formatMoneyCompact(v as number)}
            tick={{ fill: 'rgb(16 39 66 / 0.6)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(16,39,66,0.18)' }}
            contentStyle={{
              background: '#ffffff',
              border: '1px solid rgba(16,39,66,0.12)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
            }}
            labelStyle={{ color: 'rgba(16,39,66,0.65)', fontWeight: 500 }}
            formatter={(value: number | string, name) => {
              if (name === 'median') return [formatMoneyFull(Number(value)), 'Median sale']
              if (name === 'sold') return [String(value), 'Sold count']
              return [String(value), String(name)]
            }}
          />
          <Area
            type="linear"
            dataKey="median"
            stroke="#102742"
            strokeWidth={2}
            fill="url(#rrPriceChartFill)"
            dot={{ r: 2.5, fill: '#102742', strokeWidth: 0 }}
            activeDot={{ r: 4, stroke: '#102742', strokeWidth: 2, fill: '#ffffff' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
