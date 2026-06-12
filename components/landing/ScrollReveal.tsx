'use client'

/**
 * ScrollReveal — shared scroll-triggered fade-up for LP sections.
 *
 * Per the approved Figma annotation spec: fade-up 400ms ease-out, 16px
 * travel, triggered once when the section enters the viewport. Implemented
 * with a single IntersectionObserver per instance and a CSS transition —
 * no animation libraries. Respects prefers-reduced-motion (content renders
 * static and fully visible).
 *
 * Server-rendered HTML starts fully visible (no opacity-0 in markup), then a
 * client effect arms the hidden state only when the element is still below
 * the viewport. Content is never lost when JS fails — progressive
 * enhancement, not a JS dependency.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  className?: string
  /** Stagger delay in ms (use 0/75/150 for card rows). */
  delayMs?: number
}

export default function ScrollReveal({ children, className, delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<'initial' | 'hidden' | 'shown'>('initial')

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Only arm the animation for elements still below the fold — anything
    // already on screen stays visible (no first-paint flash).
    const rect = el.getBoundingClientRect()
    if (rect.top >= window.innerHeight * 0.92) {
      setState('hidden')
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setState('shown')
              obs.disconnect()
            }
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
      )
      obs.observe(el)
      return () => obs.disconnect()
    }
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform] duration-400 ease-out motion-reduce:transition-none',
        state === 'hidden' && 'translate-y-4 opacity-0',
        state === 'shown' && 'translate-y-0 opacity-100',
        className,
      )}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  )
}
