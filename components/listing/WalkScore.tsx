'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ScoreData = {
  walkScore: number | null
  transitScore: number | null
  bikeScore: number | null
}

type Props = {
  /** Walk/transit/bike scores. Null values mean "not available for this location." */
  scores: ScoreData | null
  /** Property address for WalkScore link */
  address?: string
  className?: string
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Walker's Paradise"
  if (score >= 70) return 'Very Walkable'
  if (score >= 50) return 'Somewhat Walkable'
  if (score >= 25) return 'Car-Dependent'
  return 'Almost All Errands Require a Car'
}

function getTransitLabel(score: number): string {
  if (score >= 70) return 'Excellent Transit'
  if (score >= 50) return 'Good Transit'
  if (score >= 25) return 'Some Transit'
  return 'Minimal Transit'
}

function getBikeLabel(score: number): string {
  if (score >= 90) return "Biker's Paradise"
  if (score >= 70) return 'Very Bikeable'
  if (score >= 50) return 'Bikeable'
  return 'Somewhat Bikeable'
}

function ScoreBar({ score, label, title }: { score: number; label: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-12 shrink-0 items-center justify-center">
        <span className="text-xl font-bold text-foreground">{score}</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              score >= 70 ? 'bg-success' : score >= 50 ? 'bg-warning' : 'bg-muted-foreground'
            )}
            style={{ width: `${score}%` }}
          />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

/**
 * WalkScore — displays Walk Score, Transit Score, and Bike Score for a property.
 *
 * In Central Oregon most properties will have low transit scores and moderate
 * walk/bike scores. The component handles this gracefully.
 *
 * Data can come from:
 * - WalkScore API (free for low-volume sites)
 * - Pre-computed from Spark listing data
 * - Hardcoded per-community defaults
 */
export default function WalkScore({ scores, address, className }: Props) {
  if (!scores || (scores.walkScore == null && scores.transitScore == null && scores.bikeScore == null)) {
    return null
  }

  return (
    <Card className={className}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Location Scores</h3>
          {address && (
            <Badge variant="outline" className="text-xs">
              <a
                href={`https://www.walkscore.com/score/${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                WalkScore.com
              </a>
            </Badge>
          )}
        </div>

        {scores.walkScore != null && (
          <ScoreBar
            score={scores.walkScore}
            title="Walk Score"
            label={getScoreLabel(scores.walkScore)}
          />
        )}

        {scores.transitScore != null && (
          <ScoreBar
            score={scores.transitScore}
            title="Transit Score"
            label={getTransitLabel(scores.transitScore)}
          />
        )}

        {scores.bikeScore != null && (
          <ScoreBar
            score={scores.bikeScore}
            title="Bike Score"
            label={getBikeLabel(scores.bikeScore)}
          />
        )}
      </CardContent>
    </Card>
  )
}
