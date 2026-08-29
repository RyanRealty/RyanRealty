/**
 * Market Chart Room. Time first, Relate second, Rank only when a real rank
 * plots. One V3ChartSwitch, one series on the first screen.
 */
import { V3Chart, V3ChartSwitch, v3Text, type V3ChartProps } from '@/components/site/v3'

export function MarketChartRoom({
  time,
  relate,
  rank,
}: {
  time: V3ChartProps
  relate?: V3ChartProps
  rank?: V3ChartProps
}) {
  const items = [{ key: 'time', label: v3Text('Time') }]
  const panels = [<V3Chart key="time" {...time} id="market-chart-time" />]
  if (relate) {
    items.push({ key: 'relate', label: v3Text('Relate') })
    panels.push(<V3Chart key="relate" {...relate} id="market-chart-relate" />)
  }
  if (rank) {
    items.push({ key: 'rank', label: v3Text('Rank') })
    panels.push(<V3Chart key="rank" {...rank} id="market-chart-rank" />)
  }
  if (items.length === 1) return <V3Chart {...time} id="market-chart-time" />
  return (
    <V3ChartSwitch label={v3Text('Chart')} items={items} defaultKey="time">
      {panels}
    </V3ChartSwitch>
  )
}
