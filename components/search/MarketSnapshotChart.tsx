'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type PricePoint = { month: string; medianPrice: number }

function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatMonth(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

type Props = {
  data: PricePoint[]
}

export default function MarketSnapshotChart({ data }: Props) {
  if (data.length < 2) return null
  const chartData = data.map((p) => ({ ...p, monthLabel: formatMonth(p.month) }))

  return (
    <div className="h-[180px] w-full min-w-[200px] max-w-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
          <YAxis
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            width={40}
          />
          <Tooltip
            formatter={(v: number) => [formatPrice(v), 'Median']}
            labelFormatter={formatMonth}
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'var(--foreground)' }}
          />
          <Line
            type="monotone"
            dataKey="medianPrice"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
