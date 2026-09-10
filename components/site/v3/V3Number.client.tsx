'use client'

/**
 * Animated whole-number figure. Adapted from Rare UI animatedcounter + beUI
 * number: count-up on first paint, then the formatted string. Tokens inherit;
 * no second palette. Respects prefers-reduced-motion (prints final value).
 *
 * The caller still owns §0: pass the live count and its already-formatted
 * display string so the number on screen matches the source trace.
 */
import { useEffect, useRef, useState } from 'react'
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

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function V3Number({ value, formatted, durationMs = 900, className }: V3NumberProps) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  const [face, setFace] = useState(formatted)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) {
      setFace(formatted)
      return
    }
    started.current = true
    if (typeof window === 'undefined') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || safe <= 0 || durationMs <= 0) {
      setFace(formatted)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const current = Math.round(easeOut(t) * safe)
      setFace(current.toLocaleString('en-US'))
      if (t < 1) frame = requestAnimationFrame(tick)
      else setFace(formatted)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [safe, formatted, durationMs])

  return (
    <span className={cn(V3_ROOT_CLASS, 'v3-number', className)} data-slot="v3-number">
      {face}
    </span>
  )
}
