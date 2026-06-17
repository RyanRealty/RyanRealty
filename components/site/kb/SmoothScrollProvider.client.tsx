'use client'

import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Kinetic-brutalist smooth-scroll + scroll-animation layer.
 *
 * Wraps a KB surface (homepage first; geo pages later). Mounts Lenis for
 * inertial scroll and drives GSAP ScrollTrigger off it. Honors
 * prefers-reduced-motion: when reduced, Lenis is NOT mounted (native scroll)
 * but ScrollTrigger is still registered so section reveals can resolve to
 * their final state instantly. SSR-safe — all browser access is inside the
 * effect, never at module scope.
 *
 * Scope this to the KB page tree only; do NOT mount site-wide (Lenis hijacks
 * global scroll and fights /search, /admin, map/listing pages).
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduce) {
      // No inertial scroll. ScrollTrigger still drives reveals to final state.
      ScrollTrigger.refresh()
      return () => {
        ScrollTrigger.getAll().forEach((t) => t.kill())
      }
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    lenis.on('scroll', ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    document.documentElement.classList.add('lenis')

    return () => {
      lenis.destroy()
      gsap.ticker.remove(raf)
      gsap.ticker.lagSmoothing(500, 33)
      ScrollTrigger.getAll().forEach((t) => t.kill())
      document.documentElement.classList.remove('lenis')
    }
  }, [])

  return <>{children}</>
}
