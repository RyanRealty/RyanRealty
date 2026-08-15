'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Feed-style viewport autoplay — the "the video plays when it scrolls into
 * focus" behavior from IG / TikTok / FB. Tracks every registered card's
 * intersection ratio + its distance to the viewport center, and returns the key
 * of the SINGLE most-centered card that is at least `floor` visible (or null).
 * One card plays at a time, like a social feed: on a single-column mobile layout
 * that is whichever card fills the screen; on a desktop grid or a horizontal rail
 * it is the most-centered, least-clipped one (clipping by scroll-container
 * ancestors lowers the ratio, so off-rail cards fall below the floor).
 *
 * Pair it with hover/focus state in the consumer:
 *   const active = hovered ?? inViewKey
 * so a pointer device keeps precise hover control while a touch device — where
 * hover does not exist — still autoplays on scroll. SSR-safe (no observer until
 * mount). Disabled under prefers-reduced-motion, resolved synchronously on the
 * first client render so it is correct BEFORE the first (async) observer callback
 * can start anything, and re-evaluated live if the user toggles the setting.
 *
 * Used by KbFeatured + KbCommunities. Change the behavior here and it changes
 * everywhere (KB single-source reuse contract — see components/site/kb/README.md).
 */
export function useInViewAutoplay(opts?: { floor?: number }) {
  const floor = opts?.floor ?? 0.6
  const [inViewKey, setInViewKey] = useState<string | null>(null)
  // key -> { ratio, dist } where dist = distance from the element center to the
  // viewport center (2D), so the most-centered card wins on a tie of ratios.
  const state = useRef<Map<string, { ratio: number; dist: number }>>(new Map())
  const observers = useRef<Map<string, IntersectionObserver>>(new Map())
  const refCbs = useRef<Map<string, (el: HTMLElement | null) => void>>(new Map())

  // Reduced-motion: resolve on the FIRST render (client) so it is already correct
  // before any IntersectionObserver callback (which is async, post-commit) runs —
  // closes the race where a video could autoplay then never be cleared.
  const enabled = useRef<boolean | null>(null)
  if (enabled.current === null) {
    enabled.current =
      typeof window === 'undefined' ||
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  const recompute = useCallback(() => {
    if (!enabled.current) {
      setInViewKey(null)
      return
    }
    let best: string | null = null
    let bestDist = Infinity
    state.current.forEach((s, k) => {
      if (s.ratio >= floor && s.dist < bestDist) {
        bestDist = s.dist
        best = k
      }
    })
    setInViewKey((prev) => (prev === best ? prev : best))
  }, [floor])

  useEffect(() => {
    const mq =
      typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    const onChange = () => {
      enabled.current = !(mq?.matches ?? false)
      recompute()
    }
    mq?.addEventListener?.('change', onChange)
    const live = observers.current
    // A reduced-motion mount must immediately clear any stale autoplay key.
    recompute()
    return () => {
      mq?.removeEventListener?.('change', onChange)
      live.forEach((o) => o.disconnect())
      live.clear()
    }
  }, [recompute])

  // Returns a STABLE-per-key ref callback (cached) so React does not churn the
  // observer on every render. Registers an observer on mount, tears down on unmount.
  const register = useCallback(
    (key: string) => {
      let cb = refCbs.current.get(key)
      if (cb) return cb
      cb = (el: HTMLElement | null) => {
        const existing = observers.current.get(key)
        if (existing) {
          existing.disconnect()
          observers.current.delete(key)
        }
        if (!el || typeof IntersectionObserver === 'undefined') {
          state.current.delete(key)
          recompute()
          return
        }
        const io = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) {
                state.current.set(key, { ratio: 0, dist: Infinity })
                continue
              }
              const root = e.rootBounds
              const vpW = typeof window !== 'undefined' ? window.innerWidth : 0
              const vpH = typeof window !== 'undefined' ? window.innerHeight : 0
              const vpCx = root ? root.left + root.width / 2 : vpW / 2
              const vpCy = root ? root.top + root.height / 2 : vpH / 2
              const r = e.boundingClientRect
              const dist = Math.hypot(r.left + r.width / 2 - vpCx, r.top + r.height / 2 - vpCy)
              state.current.set(key, { ratio: e.intersectionRatio, dist })
            }
            recompute()
          },
          { threshold: [0, 0.25, 0.5, 0.6, 0.75, 0.9, 1] },
        )
        io.observe(el)
        observers.current.set(key, io)
      }
      refCbs.current.set(key, cb)
      return cb
    },
    [recompute],
  )

  return { inViewKey, register }
}
