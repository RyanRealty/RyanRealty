/**
 * Sold-count line for the custom report. Median stays on the grid: the two
 * series do not share a Y axis.
 */
import { AChart } from '@/components/admin/v2'
import type { ReportMetricsTimeSeriesPoint } from '@/app/actions/reports'

export function ReportTimeSeriesChart({
  points,
  caption,
  id,
}: {
  points: ReportMetricsTimeSeriesPoint[]
  caption: string
  id: string
}) {
  return (
    <AChart
      id={id}
      caption={caption}
      kind="line"
      series={[
        {
          name: 'Sold',
          points: points.map((row) => ({
            value: row.sold_count,
            tick: row.month_label,
            label: String(row.sold_count),
          })),
        },
      ]}
      emptyReason="No month came back for this series."
    />
  )
}
