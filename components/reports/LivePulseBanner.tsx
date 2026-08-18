import { Card, CardContent } from '@/components/ui/card'
import { publishPulseFreshnessStamp } from '@/lib/market/publish-pulse-freshness'

type Props = {
  title: string
  activeCount: number
  pendingCount: number
  newCount7d: number
  updatedAt?: string | null
}

function formatUpdatedAt(value?: string | null) {
  return publishPulseFreshnessStamp(value) ?? 'Updated recently'
}

export default function LivePulseBanner({ title, activeCount, pendingCount, newCount7d, updatedAt }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{formatUpdatedAt(updatedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-foreground">Active {activeCount.toLocaleString()}</span>
          <span className="text-foreground">Pending {pendingCount.toLocaleString()}</span>
          <span className="text-foreground">New 7d {newCount7d.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  )
}
