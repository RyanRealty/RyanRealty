import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  /** Display label (e.g., "Median Sale Price") */
  label: string
  /** Formatted value (e.g., "$525,000") */
  value: string
  /** Year-over-year change percentage (e.g., 5.2 or -3.1) */
  yoyChange?: number | null
  /** Optional subtitle or context (e.g., "Last 30 days") */
  subtitle?: string
  /** Optional icon or emoji */
  icon?: React.ReactNode
}

/**
 * StatCard — displays a single market statistic with optional YoY trend arrow.
 * Used on market report pages, dashboards, and area context sections.
 */
export default function StatCard({ label, value, yoyChange, subtitle, icon }: Props) {
  const hasChange = yoyChange != null && !Number.isNaN(yoyChange)
  const isPositive = hasChange && yoyChange > 0
  const isNegative = hasChange && yoyChange < 0

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
            {hasChange && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  isPositive && 'text-success',
                  isNegative && 'text-destructive',
                  !isPositive && !isNegative && 'text-muted-foreground'
                )}
              >
                {isPositive ? '↑' : isNegative ? '↓' : '→'}
                {Math.abs(yoyChange).toFixed(1)}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
