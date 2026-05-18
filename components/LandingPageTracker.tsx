'use client'

import { useEffect, useRef } from 'react'
import { trackEvent, trackLandingPageView, type LpContext } from '@/lib/tracking'

type Props = {
  lpVariant: string
}

/**
 * Drop into the top of every landing page (Next.js `app/lp/<variant>/page.tsx`).
 * On mount it fires `view_landing_page` with UTM context captured from URL,
 * persists that context to sessionStorage so the LP's form can enrich its
 * submit event via getLpContext(), and wires scroll-depth listeners that
 * fire at the 25 / 50 / 75 / 100 % thresholds.
 *
 * Canonical contract:
 * marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md
 */
export default function LandingPageTracker({ lpVariant }: Props) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    const ctx: LpContext = trackLandingPageView(lpVariant)
    const firedDepths = new Set<number>()

    function onScroll() {
      const doc = document.documentElement
      const scrollTop = window.scrollY || doc.scrollTop || 0
      const viewport = window.innerHeight || doc.clientHeight || 0
      const scrollable = (doc.scrollHeight || 0) - viewport
      if (scrollable <= 0) return
      const depthPct = Math.min(100, Math.round(((scrollTop + viewport) / (scrollable + viewport)) * 100))
      for (const threshold of [25, 50, 75, 100]) {
        if (depthPct >= threshold && !firedDepths.has(threshold)) {
          firedDepths.add(threshold)
          trackEvent('scroll_depth', {
            lp_variant: ctx.lp_variant,
            depth_percent: threshold,
            lp_source: ctx.lp_source,
            lp_campaign: ctx.lp_campaign,
          })
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    // Fire once immediately so short LPs that don't trigger scroll still
    // get a 25 / 50 / 75 / 100 reading if the entire LP is above the fold.
    onScroll()

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [lpVariant])

  return null
}
