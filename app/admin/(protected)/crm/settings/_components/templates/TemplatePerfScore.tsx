'use client'

/**
 * TemplatePerfScore — §13.8 score display for the text-template table.
 *
 * States:
 *   score null, no review flag → "Pending (–)" quiet (unscored is NOT zero)
 *   score set                  → "[score] ([score]%)" color-coded by band
 *   needsReview                → the danger StateWord "Needs Review"
 *
 * No scoring model runs in-house yet, so every live row renders Pending — the
 * honest §0 state (a fabricated score would be a false claim).
 *
 * P11 admin v2: shadcn Badge → StateWord (status is text + color, never color
 * alone); the band colors are the locked --a-ok / --a-warn / --a-danger tokens
 * instead of the public brand's semantic classes.
 */
import { StateWord } from '@/components/admin/v2'

export function TemplatePerfScore({
  score,
  needsReview = false,
}: {
  score: number | null
  needsReview?: boolean
}) {
  if (needsReview) {
    return <StateWord state="down">Needs Review</StateWord>
  }
  if (score === null) {
    return <span style={{ color: 'var(--a-text-2)' }}>Pending (–)</span>
  }
  return (
    <span
      className="a-num"
      style={{
        fontWeight: 500,
        color: score >= 75 ? 'var(--a-ok)' : score >= 40 ? 'var(--a-warn)' : 'var(--a-danger)',
      }}
    >
      {score} ({score}%)
    </span>
  )
}
