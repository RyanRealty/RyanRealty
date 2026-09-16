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
  /** When false, count up on mount (fold numerals that may never hit 60% in-view). */
  startOnView?: boolean
  /**
   * Publish the sourced face on the server (SITE-117). Default true — a
   * hydration flash of `0` is a wrong number in the HTML (CLAUDE.md §0).
   * Pass false only for a decorative count-up the caller has already
   * decided is not a published figure. Animate on later value changes
   * either way (AnimatedNumber.settleOnMount).
   */
  settle?: boolean
  className?: string
}

export function V3Number({
  value,
  formatted,
  durationMs = 900,
  startOnView = true,
  settle = true,
  className,
}: V3NumberProps) {
  // Never invent 0. A missing or non-finite count is an empty face, not data.
  if (!Number.isFinite(value) || value < 0) return null
  return (
    <AnimatedNumber
      value={value}
      settleOnMount={settle}
      duration={Math.max(0, durationMs) / 1000}
      format={(n) => {
        if (Math.round(n) === Math.round(value)) return formatted
        return Math.round(n).toLocaleString('en-US')
      }}
      className={cn(V3_ROOT_CLASS, 'v3-number', className)}
      startOnView={startOnView}
    />
  )
}
