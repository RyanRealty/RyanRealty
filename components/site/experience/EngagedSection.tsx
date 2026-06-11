'use client'

/**
 * EngagedSection — Experience System shared module.
 *
 * A thin client wrapper that gives any server-rendered section the standard
 * engagement telemetry (section_view via IntersectionObserver, per
 * docs/EXPERIENCE_SYSTEM.md §4) without converting the section's content to a
 * client component. Children stay server-rendered (passed through as a slot).
 *
 *   <EngagedSection id="intro" pageType="geo" position={3} className="...">
 *     ...server content...
 *   </EngagedSection>
 */

import { useRef } from 'react'
import { useEngagementTracking } from './useEngagementTracking'

type Props = {
  /** Section id — used for both the DOM id (anchor target) and the section_view event. */
  id: string
  pageType?: string
  position?: number
  className?: string
  ariaLabel?: string
  children: React.ReactNode
}

export function EngagedSection({ id, pageType = 'geo', position, className, ariaLabel, children }: Props) {
  const ref = useRef<HTMLElement>(null)
  useEngagementTracking(id, { ref, pageType, position })
  return (
    <section id={id} ref={ref} className={className} aria-label={ariaLabel}>
      {children}
    </section>
  )
}
