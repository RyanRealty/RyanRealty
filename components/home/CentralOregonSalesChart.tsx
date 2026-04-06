'use client'

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { ReportMetricsTimeSeriesPoint } from '@/app/actions/reports'

const chartConfig = {
  sold_count: { label: 'Closed sales', color: 'var(--chart-1)' },
} satisfies ChartConfig

type Props = {
  series: ReportMetricsTimeSeriesPoint[]
}

/**
 * Single regional chart for the home page snapshot (sum of closed sales by month, residential filters applied upstream).
 */
export default function CentralOregonSalesChart({ series }: Props) {
  const data = [...series]
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .map((p) => ({
      month: p.month_label,
      sold_count: p.sold_count ?? 0,
    }))

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Monthly sales trend is updating. Check back shortly or open a city report for detail.
      </p>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full max-w-4xl">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="4 4" className="stroke-border" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        />
        <YAxis
          width={40}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="sold_count"
          stroke="var(--color-sold_count)"
          strokeWidth={2}
          dot={{ r: 2, fill: 'var(--color-sold_count)' }}
        />
      </LineChart>
    </ChartContainer>
  )
}
