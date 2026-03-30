'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  /** Market health score 0-100 */
  score: number | null | undefined
  /** Optional label override (auto-computed from score if not provided) */
  label?: string
  /** Optional compact mode for inline display */
  compact?: boolean
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Very Hot'
  if (score >= 60) return 'Hot'
  if (score >= 40) return 'Warm'
  if (score >= 20) return 'Cool'
  return 'Cold'
}

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-destructive' // Very hot — red/urgent
  if (score >= 60) return 'text-warning' // Hot — amber
  if (score >= 40) return 'text-foreground' // Warm — neutral
  if (score >= 20) return 'text-primary' // Cool — blue
  return 'text-muted-foreground' // Cold — muted
}

function getHealthBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 80) return 'destructive'
  if (score >= 60) return 'default'
  if (score >= 40) return 'secondary'
  return 'outline'
}

/**
 * MarketHealthGauge — displays a 0-100 market health score with label and visual indicator.
 *
 * Score breakdown:
 * - 80-100: Very Hot (strong seller's market)
 * - 60-79:  Hot (seller-leaning)
 * - 40-59:  Warm (balanced)
 * - 20-39:  Cool (buyer-leaning)
 * - 0-19:   Cold (strong buyer's market)
 */
export default function MarketHealthGauge({ score, label, compact }: Props) {
  if (score == null || Number.isNaN(score)) {
    return compact ? null : (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Market health data not available</p>
        </CardContent>
      </Card>
    )
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(score)))
  const healthLabel = label ?? getHealthLabel(clampedScore)
  const colorClass = getHealthColor(clampedScore)
  const badgeVariant = getHealthBadgeVariant(clampedScore)

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className={cn('text-lg font-bold', colorClass)}>{clampedScore}</span>
        <Badge variant={badgeVariant}>{healthLabel}</Badge>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Market Health</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={cn('text-3xl font-bold tracking-tight', colorClass)}>
                {clampedScore}
              </span>
              <Badge variant={badgeVariant} className="text-xs">
                {healthLabel}
              </Badge>
            </div>
          </div>
        </div>

        {/* Visual gauge bar */}
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                clampedScore >= 80 && 'bg-destructive',
                clampedScore >= 60 && clampedScore < 80 && 'bg-warning',
                clampedScore >= 40 && clampedScore < 60 && 'bg-primary',
                clampedScore >= 20 && clampedScore < 40 && 'bg-secondary',
                clampedScore < 20 && 'bg-muted-foreground',
              )}
              style={{ width: `${clampedScore}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Cold</span>
            <span>Cool</span>
            <span>Warm</span>
            <span>Hot</span>
            <span>Very Hot</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
