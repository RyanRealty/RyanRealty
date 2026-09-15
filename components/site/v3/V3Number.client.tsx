'use client'

/**
 * Digit-swap figure. Wraps the installed beUI DigitSwap
 * (`components/motion/digit-swap.tsx`). The caller still owns §0: pass the live
 * count and its already-formatted display string so the settled face matches
 * the source trace.
 */
import { DigitSwap } from '@/components/motion/digit-swap'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Number.css'

export type V3NumberProps = {
  /** Live numeric value (drives the wheel). */
  value: number
  /** Already-formatted string for the settled face, e.g. "3,281". */
  formatted: string
  /** Rough settle time in ms. */
  durationMs?: number
  /** When false, count up on mount (fold numerals that may never hit 60% in-view). */
  startOnView?: boolean
  className?: string
}

export function V3Number({
  value,
  formatted,
  className,
}: V3NumberProps) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0
  return (
    <DigitSwap
      value={formatted}
      animationKey={safe}
      className={cn(V3_ROOT_CLASS, 'v3-number', className)}
    />
  )
}
