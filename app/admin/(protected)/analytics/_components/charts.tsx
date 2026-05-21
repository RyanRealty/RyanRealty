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

const BRAND_COLORS = ['#102742', '#5b6473', '#8b94a3', '#a7b0bf', '#c3ccdb'] as const

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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => (formatter ? formatter(Number(v)) : String(v))} />
        <YAxis type="category" dataKey={xKey} stroke="hsl(var(--muted-foreground))" width={180} interval={0} />
        <Tooltip
          formatter={(v: number) => (formatter ? formatter(v) : v.toLocaleString())}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
        />
        <Bar dataKey={yKey} fill="#102742" radius={[0, 4, 4, 0]} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" tickFormatter={(d) => String(d).slice(5)} />
        <YAxis stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
          formatter={(v: number) => v.toLocaleString()}
        />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? BRAND_COLORS[i % BRAND_COLORS.length]}
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
            <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
        <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
        />
        <Legend />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} stackId="mix" fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
