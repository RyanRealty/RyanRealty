/**
 * useCountUp — Experience System shared hook
 *
 * Animates a numeric value from 0 to `target` over `duration` ms on first
 * viewport entry. Designed to avoid hydration mismatches:
 *   - Server-side: returns target immediately (SSR renders final value).
 *   - Client-side: starts at target on hydration then triggers the animation
 *     once the IntersectionObserver fires, avoiding a flash on load.
 *
 * Respects prefers-reduced-motion — when set, the count-up is skipped and
 * the final value renders immediately.
 *
 * Usage:
 *   const { ref, displayValue } = useCountUp(42, { duration: 900 })
 *   return <span ref={ref}>{displayValue}</span>
 */
'use client'

import { useEffect, useRef, useState, RefObject } from 'react'

type Options = {
  /** Animation duration in milliseconds. Default 900. */
  duration?: number
  /** Easing function — easeOut by default. */
  easing?: (t: number) => number
  /** Format function for display. Default: toLocaleString(). */
  format?: (n: number) => string
  /** Optional external ref to observe. If not supplied, a new ref is created. */
  ref?: RefObject<HTMLElement | null>
}

type Return = {
  /** Attach this ref to the element that should trigger the animation on scroll-into-view. */
  ref: RefObject<HTMLElement | null>
  /** Formatted display value. On SSR this equals format(target). */
  displayValue: string
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Returns true on the server; false on the client after first render.
 * Used to serve the final value in SSR HTML so client re-hydrates to the
 * same value, then animates on viewport entry.
 */
function useIsSSR(): boolean {
  const [isSSR, setIsSSR] = useState(true)
  useEffect(() => { setIsSSR(false) }, [])
  return isSSR
}

export function useCountUp(
  target: number | null,
  {
    duration = 900,
    easing = easeOutCubic,
    format = (n: number) => n.toLocaleString(),
    ref: externalRef,
  }: Options = {},
): Return {
  const isSSR = useIsSSR()
  const internalRef = useRef<HTMLElement | null>(null)
  const ref = externalRef ?? internalRef as RefObject<HTMLElement | null>

  const safeTarget = target ?? 0
  const [count, setCount] = useState(safeTarget)
  const hasAnimated = useRef(false)
  const prefersReduced = useRef(false)

  // Check prefers-reduced-motion once on the client
  useEffect(() => {
    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Keep count in sync if target prop changes before animation
  useEffect(() => {
    if (!hasAnimated.current) {
      setCount(safeTarget)
    }
  }, [safeTarget])

  useEffect(() => {
    if (isSSR || target == null) return
    if (typeof IntersectionObserver === 'undefined') return

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return
        hasAnimated.current = true
        observer.disconnect()

        // Respect prefers-reduced-motion
        if (prefersReduced.current) {
          setCount(safeTarget)
          return
        }

        const start = performance.now()
        const from = 0

        // Settle guard: rAF is throttled/suspended in background or busy tabs,
        // which stranded hero stats at the animation's starting 0 (Matt hit
        // this live on /communities/broken-top, 2026-06-10 — hero said 0
        // active while the band said 1). Whatever happens to the animation,
        // the final value lands.
        const settle = window.setTimeout(() => setCount(safeTarget), duration + 150)

        const tick = (now: number) => {
          const elapsed = now - start
          const t = Math.min(elapsed / duration, 1)
          const value = Math.round(from + easing(t) * (safeTarget - from))
          setCount(value)
          if (t < 1) {
            requestAnimationFrame(tick)
          } else {
            window.clearTimeout(settle)
            setCount(safeTarget)
          }
        }

        requestAnimationFrame(tick)
      },
      { threshold: 0.3 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [isSSR, target, safeTarget, duration, easing, ref])

  // On SSR, return the final value so the HTML matches what the client will
  // hydrate to. The animation starts after the first IntersectionObserver fire.
  const displayValue = format(isSSR ? safeTarget : count)

  return { ref, displayValue }
}
