'use client'

/**
 * HomepageCineParallax — full-bleed background parallax for the cinematic
 * homepage bands. The inner layer is oversized (scale 1.14 in CSS) and
 * translated against scroll at a gentle rate while the band is on screen.
 *
 * Engineering notes: rAF-throttled scroll handler, IntersectionObserver so
 * off-screen bands cost nothing, passive listeners, and prefers-reduced-motion
 * leaves a static (lightly zoomed) image with zero JS work.
 */

import { useEffect, useRef, type ReactNode } from 'react'

export default function HomepageCineParallax({
  children,
  speed = 0.12,
}: {
  children: ReactNode
  speed?: number
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let active = false

    const update = () => {
      raf = 0
      const r = outer.getBoundingClientRect()
      const delta = r.top + r.height / 2 - window.innerHeight / 2
      inner.style.transform = `translate3d(0, ${(-delta * speed).toFixed(1)}px, 0) scale(1.14)`
    }
    const schedule = () => {
      if (active && !raf) raf = requestAnimationFrame(update)
    }

    const io = new IntersectionObserver(([entry]) => {
      active = entry.isIntersecting
      schedule()
    })
    io.observe(outer)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    update()

    return () => {
      io.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(raf)
    }
  }, [speed])

  return (
    <div ref={outerRef} className="cine-parallax" aria-hidden="true">
      <div ref={innerRef} className="cine-parallax-inner">
        {children}
      </div>
    </div>
  )
}
