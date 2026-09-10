'use client'

/**
 * Animated whole-number figure. Wraps the installed beUI number
 * (`components/motion/number.tsx`). The caller still owns §0: pass the live
 * count and its already-formatted display string so the settled face matches
 * the source trace.
 */
import { AnimatedNumber } from '@/components/motion/number'
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
  className?: string
}

export function V3Number({ value, formatted, durationMs = 900, className }: V3NumberProps) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0
  return (
    <AnimatedNumber
      value={safe}
      duration={Math.max(0, durationMs) / 1000}
      format={(n) => {
        if (Math.round(n) === Math.round(safe)) return formatted
        return Math.round(n).toLocaleString('en-US')
      }}
      className={cn(V3_ROOT_CLASS, 'v3-number', className)}
      startOnView
    />
  )
}
