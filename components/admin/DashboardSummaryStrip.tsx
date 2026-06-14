import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Tone = 'default' | 'success' | 'warning'

export type SummaryStat = {
  label: string
  /** Pre-formatted value, or null when the underlying source is unavailable. */
  value: string | null
  caption?: string
  tone?: Tone
}

const toneClass: Record<Tone, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
}

/**
 * Glanceable KPI strip for the operations overview. Purely presentational:
 * every value is pre-formatted by the caller from data already fetched on the
 * page. A null value renders a muted em-dash so a section never leaves a hole.
 */
export default function DashboardSummaryStrip({ stats }: { stats: SummaryStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <Card key={stat.label} size="sm">
          <CardContent className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </p>
            <p
              className={cn(
                'text-2xl font-semibold tabular-nums leading-none',
                stat.value === null ? 'text-muted-foreground' : toneClass[stat.tone ?? 'default']
              )}
            >
              {stat.value ?? '—'}
            </p>
            {stat.caption ? (
              <p className="text-xs text-muted-foreground">{stat.caption}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
