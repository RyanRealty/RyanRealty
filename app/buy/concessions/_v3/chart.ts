import { v3Text, type V3ChartPoint, type V3ChartProps } from '@/components/site/v3'
import { formatUnit, MONTH_TICKS, percentTicks, spacedTicks } from '@/lib/charts/ticks'
import { MONTHLY_SHARE, ON_SCREEN } from '@/lib/concessions/results'

function monthTick(year: number, month: number): string {
  const name = MONTH_TICKS[month - 1] ?? String(month)
  return `${name} ${year}`
}

export function buildConcessionShareChart(): V3ChartProps {
  const points: V3ChartPoint[] = MONTHLY_SHARE.map((row, i) => {
    const tick = monthTick(row.year, row.month)
    const label = formatUnit(row.sharePct, 'percent')
    return {
      value: row.sharePct,
      tick: v3Text(tick),
      label: v3Text(label || `${row.sharePct}%`),
      at: i,
    }
  })
  const series = [{ name: v3Text('Share with a seller concession'), points }]
  const yTicks = percentTicks(series)
  const xTicks = spacedTicks(series, 4)
  return {
    caption: v3Text('Share of Bend sales with a seller concession, Oct 2024 to Sep 2026'),
    claim: v3Text(
      `The share of Bend sales with a seller concession rose from ${ON_SCREEN.sep2025ShareRounded}% in Sep 2025 to ${ON_SCREEN.sep2026ShareRounded}% in Sep 2026.`,
    ),
    series,
    marks: true,
    hover: true,
    emphasize: 'last',
    emphasisTone: 'ink',
    ...(yTicks.length ? { yTicks } : {}),
    ...(xTicks.length ? { xTicks } : {}),
  }
}
