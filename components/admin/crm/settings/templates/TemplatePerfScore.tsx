'use client'

/**
 * TemplatePerfScore — §13.8 score display for the text-template table.
 *
 * States:
 *   score null, no review flag → "Pending (–)" muted (unscored is NOT zero)
 *   score set                  → "[score] ([score]%)" color-coded by band
 *   needsReview                → destructive "Needs Review" badge
 *
 * No scoring model runs in-house yet, so every live row renders Pending — the
 * honest §0 state (a fabricated score would be a false claim).
 */
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function TemplatePerfScore({
  score,
  needsReview = false,
}: {
  score: number | null
  needsReview?: boolean
}) {
  if (needsReview) {
    return <Badge variant="destructive">Needs Review</Badge>
  }
  if (score === null) {
    return <span className="text-muted-foreground">Pending (–)</span>
  }
  return (
    <span
      className={cn(
        'font-medium tabular-nums',
        score >= 75 ? 'text-success-foreground' : score >= 40 ? 'text-warning-foreground' : 'text-destructive',
      )}
    >
      {score} ({score}%)
    </span>
  )
}
