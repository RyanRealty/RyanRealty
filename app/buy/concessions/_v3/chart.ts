import { v3Text, type V3ChartPoint, type V3ChartProps } from '@/components/site/v3'
import { formatUnit, MONTH_TICKS, percentTicks, spacedTicks } from '@/lib/charts/ticks'
import { MONTHLY_SHARE } from '@/lib/concessions/results'

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
  // Three ticks: four ran "Jun 2025" into "Jan 2026" at 375 (evaluator 2026-10-14).
  const xTicks = spacedTicks(series, 3)
  return {
    // The claim is the Instrument's headline; the chart carries only its caption
    // so the sentence prints once (evaluator 2026-10-14: stated three times).
    caption: v3Text('Share of Bend sales with a seller concession, Oct 2024 to Sep 2026'),
    series,
    marks: true,
    hover: true,
    emphasize: 'last',
    emphasisTone: 'ink',
    ...(yTicks.length ? { yTicks } : {}),
    ...(xTicks.length ? { xTicks } : {}),
  }
}
