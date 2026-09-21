import { V3Chart, v3Text } from '@/components/site/v3'
import { formatPriceCompact } from '@/lib/format/money'
import type { ProjectionYear } from '@/lib/rental-analysis'

type Props = {
  projection: ReadonlyArray<ProjectionYear>
}

export default function EquityProjectionChart({ projection }: Props) {
  const valuePoints = projection.map((p) => ({
    value: Math.round(p.propertyValue),
    tick: v3Text(`Year ${p.year}`),
    label: v3Text(formatPriceCompact(p.propertyValue)),
  }))
  const equityPoints = projection.map((p) => ({
    value: Math.round(Math.max(0, p.equity)),
    tick: v3Text(`Year ${p.year}`),
    label: v3Text(formatPriceCompact(Math.max(0, p.equity))),
  }))

  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
      <V3Chart
        id="equity-projection"
        caption={v3Text('Property value and equity over the hold')}
        kind="line"
        series={[
          { name: v3Text('Property value'), points: valuePoints },
          { name: v3Text('Equity'), points: equityPoints },
        ]}
        emptyReason={v3Text('The hold period did not produce two years to plot.')}
      />
    </div>
  )
}
