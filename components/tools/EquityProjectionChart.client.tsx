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
import type { ProjectionYear } from '@/lib/rental-analysis'

/**
 * EquityProjectionChart.client — recharts area chart of projected property value
 * and owner equity over the hold period, for the rental calculator. Loaded lazily
 * via next/dynamic (ssr:false) from RentalCalculator so the recharts bundle never
 * weighs down routes that don't render it (same pattern as PriceChart.client).
 *
 * Brand visual: navy area + fainter value area, cream surface, tabular-nums tooltip.
 * Colors use the locked brand navy #102742 / rgba(16,39,66,...) per Design System v2.
 */

type Props = {
  projection: ReadonlyArray<ProjectionYear>
  height?: number
}

function moneyCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
  }
  if (n >= 1_000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

function moneyFull(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export default function EquityProjectionChart({ projection, height = 260 }: Props) {
  const data = projection.map((p) => ({
    year: `Yr ${p.year}`,
    value: Math.round(p.propertyValue),
    equity: Math.round(Math.max(0, p.equity)),
  }))

  return (
    <div className="bg-card rounded-[14px] border border-border p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="rrEquityValueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#102742" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#102742" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="rrEquityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#102742" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#102742" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(16,39,66,0.08)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: 'rgb(16 39 66 / 0.6)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(16,39,66,0.12)' }}
          />
          <YAxis
            tickFormatter={(v) => moneyCompact(v as number)}
            tick={{ fill: 'rgb(16 39 66 / 0.6)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(16,39,66,0.18)' }}
            contentStyle={{
              background: '#faf8f4',
              border: '1px solid rgba(16,39,66,0.12)',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13,
              fontVariantNumeric: 'tabular-nums',
            }}
            labelStyle={{ color: 'rgba(16,39,66,0.65)', fontWeight: 500 }}
            formatter={(value: number | string, name) => {
              if (name === 'value') return [moneyFull(Number(value)), 'Property value']
              if (name === 'equity') return [moneyFull(Number(value)), 'Your equity']
              return [String(value), String(name)]
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="rgba(16,39,66,0.35)"
            strokeWidth={1.5}
            fill="url(#rrEquityValueFill)"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#102742"
            strokeWidth={2}
            fill="url(#rrEquityFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
