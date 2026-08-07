'use client'

/**
 * Recharts client wrappers. Kept thin so the server pages can pass
 * already-shaped data without importing the recharts SDK on the server.
 */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

// 11C: the admin owns its own palette (design_system/admin/ADMIN_UI.md — the
// public brand is blacklisted as design input here). Series colours step down
// the accent + neutral tokens; no status colour is spent on decoration.
const SERIES_COLORS = [
  'var(--a-accent)',
  'var(--a-accent-strong)',
  'var(--a-text-2)',
  'var(--a-border-strong)',
  'var(--a-border)',
] as const

export function HorizontalBarChart({
  data,
  xKey,
  yKey,
  height = 320,
  formatter,
}: {
  data: Record<string, string | number>[]
  xKey: string
  yKey: string
  height?: number
  formatter?: (v: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--a-border)" horizontal={false} />
        <XAxis type="number" stroke="var(--a-text-2)" tickFormatter={(v) => (formatter ? formatter(Number(v)) : String(v))} />
        <YAxis type="category" dataKey={xKey} stroke="var(--a-text-2)" width={180} interval={0} />
        <Tooltip
          formatter={(v: number) => (formatter ? formatter(v) : v.toLocaleString())}
          contentStyle={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', borderRadius: 8, color: 'var(--a-text)' }}
        />
        <Bar dataKey={yKey} fill="var(--a-accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function TimeSeriesChart({
  data,
  series,
  height = 280,
}: {
  data: { date: string; [k: string]: number | string }[]
  series: { key: string; label: string; color?: string }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--a-border)" />
        <XAxis dataKey="date" stroke="var(--a-text-2)" tickFormatter={(d) => String(d).slice(5)} />
        <YAxis stroke="var(--a-text-2)" />
        <Tooltip
          contentStyle={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', borderRadius: 8, color: 'var(--a-text)' }}
          formatter={(v: number) => v.toLocaleString()}
        />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function BrokerPieChart({
  data,
  height = 280,
}: {
  data: { broker: string; count: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="broker"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', borderRadius: 8, color: 'var(--a-text)' }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function StackedBarMix({
  data,
  height = 280,
}: {
  data: { classification: string; count: number }[]
  height?: number
}) {
  // Render as a single stacked row so it reads as a mix bar.
  // Recharts stacked-bar needs a fake date axis.
  const flattened: Record<string, number | string> = { name: 'Mix' }
  for (const r of data) flattened[r.classification] = r.count

  const keys = data.map((r) => r.classification)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={[flattened]} layout="vertical" margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--a-border)" />
        <XAxis type="number" stroke="var(--a-text-2)" />
        <YAxis type="category" dataKey="name" stroke="var(--a-text-2)" />
        <Tooltip
          contentStyle={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', borderRadius: 8, color: 'var(--a-text)' }}
        />
        <Legend />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="mix" fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
