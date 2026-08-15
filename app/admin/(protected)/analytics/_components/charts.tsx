/**
 * Admin analytics charts. Same plot geometry as the public V3Chart.
 * Skin is AChart (--a-* classes). Recharts is gone. CSS variables resolve
 * because stroke and fill are classes, not SVG presentation attributes.
 */
import { AChart } from '@/components/admin/v2'

export function HorizontalBarChart({
  data,
  xKey,
  yKey,
  formatter,
}: {
  data: Record<string, string | number>[]
  xKey: string
  yKey: string
  height?: number
  formatter?: (v: number) => string
}) {
  const points = data
    .map((row) => {
      const value = Number(row[yKey])
      const tick = String(row[xKey] ?? '')
      if (!Number.isFinite(value) || value <= 0 || !tick) return null
      const label = formatter ? formatter(value) : value.toLocaleString('en-US')
      return { value, tick, label }
    })
    .filter((p): p is { value: number; tick: string; label: string } => p != null)

  return (
    <AChart
      caption="Top sources by lead volume"
      kind="bars"
      layout="horizontal"
      baselineLabel="0"
      series={[{ name: 'Leads', points }]}
      emptyReason="No source attribution in this range."
    />
  )
}

export function TimeSeriesChart({
  data,
  series,
}: {
  data: { date: string; [k: string]: number | string }[]
  series: { key: string; label: string; color?: string }[]
  height?: number
}) {
  const plotted = series.map((s) => ({
    name: s.label,
    points: data.map((row, i) => {
      const value = Number(row[s.key])
      const tick = String(row.date)
      return {
        value: Number.isFinite(value) ? value : Number.NaN,
        tick,
        label: Number.isFinite(value) ? value.toLocaleString('en-US') : 'n/a',
        at: i,
      }
    }),
  }))

  return (
    <AChart
      caption="Sessions and leads by day"
      kind="line"
      series={plotted}
      emptyReason="No daily snapshots in this range."
    />
  )
}

export function BrokerPieChart({
  data,
}: {
  data: { broker: string; count: number }[]
  height?: number
}) {
  const points = data
    .filter((r) => r.count > 0 && r.broker)
    .map((r) => ({
      value: r.count,
      tick: r.broker,
      label: r.count.toLocaleString('en-US'),
    }))

  return (
    <AChart
      caption="Broker attribution"
      kind="bars"
      layout="horizontal"
      baselineLabel="0"
      series={[{ name: 'Leads', points }]}
      emptyReason="No broker assignments in this range."
    />
  )
}

export function StackedBarMix({
  data,
}: {
  data: { classification: string; count: number }[]
  height?: number
}) {
  const points = data
    .filter((r) => r.count > 0 && r.classification)
    .map((r) => ({
      value: r.count,
      tick: r.classification,
      label: r.count.toLocaleString('en-US'),
    }))

  return (
    <AChart
      caption="Lead channel mix"
      kind="mix"
      series={[{ name: 'Leads', points }]}
      emptyReason="No leads captured in this range."
    />
  )
}
