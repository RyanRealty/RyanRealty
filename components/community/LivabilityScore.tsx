'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type LivabilityComponent = {
  name: string
  score: number // 0-100
  description: string
}

export type LivabilityData = {
  overallScore: number // 0-100
  components: LivabilityComponent[]
  summary: string
}

type Props = {
  data: LivabilityData | null
  communityName: string
  className?: string
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-primary'
  if (score >= 40) return 'text-warning'
  return 'text-destructive'
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Outstanding'
  if (score >= 80) return 'Excellent'
  if (score >= 70) return 'Very Good'
  if (score >= 60) return 'Good'
  if (score >= 50) return 'Average'
  if (score >= 40) return 'Below Average'
  return 'Limited'
}

/**
 * LivabilityScore — custom community livability scoring.
 *
 * Components:
 * - Outdoor Access (Central Oregon's key differentiator)
 * - Walkability
 * - Schools
 * - Amenities (restaurants, shops, services)
 * - Market Health (price trends, inventory)
 * - Safety
 *
 * Score methodology is transparent — each component shows
 * its individual score and what it measures.
 */
export default function LivabilityScore({ data, communityName, className }: Props) {
  if (!data) return null

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {communityName} Livability
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Community quality score
            </p>
          </div>
          <div className="text-center">
            <span className={cn('text-3xl font-bold', getScoreColor(data.overallScore))}>
              {data.overallScore}
            </span>
            <p className="text-xs text-muted-foreground">{getScoreLabel(data.overallScore)}</p>
          </div>
        </div>

        {/* Overall bar */}
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                data.overallScore >= 70 ? 'bg-success' : data.overallScore >= 50 ? 'bg-primary' : 'bg-warning'
              )}
              style={{ width: `${data.overallScore}%` }}
            />
          </div>
        </div>

        {/* Component scores */}
        <div className="mt-4 space-y-3">
          {data.components.map((component) => (
            <div key={component.name}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{component.name}</span>
                <span className={cn('text-sm font-semibold', getScoreColor(component.score))}>
                  {component.score}
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    component.score >= 70 ? 'bg-success/60' : component.score >= 50 ? 'bg-primary/60' : 'bg-warning/60'
                  )}
                  style={{ width: `${component.score}%` }}
                />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{component.description}</p>
            </div>
          ))}
        </div>

        {data.summary && (
          <p className="mt-4 text-sm text-muted-foreground">{data.summary}</p>
        )}

        <p className="mt-3 text-[10px] text-muted-foreground">
          Livability scores are calculated from publicly available data including walkability,
          school ratings, outdoor recreation access, and market conditions.
        </p>
      </CardContent>
    </Card>
  )
}
