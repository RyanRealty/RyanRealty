'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type School = {
  name: string
  gradeRange: string // e.g., "K-5", "6-8", "9-12"
  type: 'elementary' | 'middle' | 'high' | 'other'
  distance?: string // e.g., "0.5 mi"
  rating?: number | null // 1-10 GreatSchools rating
}

type Props = {
  schools: School[]
  className?: string
}

function ratingColor(rating: number): string {
  if (rating >= 8) return 'bg-success text-success-foreground'
  if (rating >= 6) return 'bg-warning text-warning-foreground'
  if (rating >= 4) return 'bg-muted text-muted-foreground'
  return 'bg-destructive text-destructive-foreground'
}

function typeLabel(type: School['type']): string {
  switch (type) {
    case 'elementary': return 'Elementary'
    case 'middle': return 'Middle'
    case 'high': return 'High'
    default: return 'School'
  }
}

/**
 * NearbySchools — displays assigned/nearby schools with ratings.
 *
 * Data sources:
 * - GreatSchools API
 * - Spark listing data (school district fields)
 * - Pre-computed per-community data
 *
 * Grouped by school level (Elementary, Middle, High).
 */
export default function NearbySchools({ schools, className }: Props) {
  if (!schools || schools.length === 0) return null

  // Group by type
  const groups = {
    elementary: schools.filter(s => s.type === 'elementary'),
    middle: schools.filter(s => s.type === 'middle'),
    high: schools.filter(s => s.type === 'high'),
    other: schools.filter(s => s.type === 'other'),
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Nearby Schools</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          School ratings from GreatSchools (1 to 10)
        </p>

        <div className="mt-3 space-y-4">
          {(['elementary', 'middle', 'high', 'other'] as const).map(type => {
            const group = groups[type]
            if (group.length === 0) return null

            return (
              <div key={type}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {typeLabel(type)}
                </p>
                <div className="space-y-2">
                  {group.map((school, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {school.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Grades {school.gradeRange}
                          {school.distance && <> · {school.distance}</>}
                        </p>
                      </div>
                      {school.rating != null && (
                        <Badge
                          className={cn(
                            'shrink-0 text-xs font-bold',
                            ratingColor(school.rating)
                          )}
                        >
                          {school.rating}/10
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-[10px] text-muted-foreground">
          School data is for reference only. Contact the school district to verify enrollment boundaries.
        </p>
      </CardContent>
    </Card>
  )
}
