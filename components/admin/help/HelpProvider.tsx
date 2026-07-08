'use client'

/**
 * HelpProvider — mounts the persistent Help button in the admin shell and owns
 * the driver.js tour engine. Rendered once by the admin layouts (protected +
 * console), so the Help button rides every admin page, desktop and mobile.
 *
 * driver.js injects its own DOM outside React, so its popover is styled by
 * help-driver.css (token-based override — the one allowed custom-CSS
 * exception, see that file's header).
 */

import 'driver.js/dist/driver.css'
import './help-driver.css'
import { useCallback } from 'react'
import { driver } from 'driver.js'
import { toast } from 'sonner'
import type { Tour } from '@/components/admin/help/tours'
import type { HelpArticleMeta } from '@/components/admin/help/types'
import HelpButton from '@/components/admin/help/HelpButton'

/** An element counts as a valid tour target only if it exists AND is visible. */
function isVisible(selector: string): boolean {
  const el = document.querySelector(selector)
  if (!el) return false
  return (el as HTMLElement).getClientRects().length > 0
}

export default function HelpProvider({ articles }: { articles: HelpArticleMeta[] }) {
  const startTour = useCallback((tour: Tour) => {
    // Filter to steps whose target exists and is visible right now, so a tour
    // never crashes on role-gated sections or the other viewport's layout.
    const steps = tour.steps.filter((s) => isVisible(s.selector))
    if (steps.length === 0) {
      toast('Nothing to show on this screen yet. Try this tour on a larger screen or after the page loads.')
      return
    }
    const d = driver({
      showProgress: steps.length > 1,
      overlayOpacity: 0.5,
      stagePadding: 6,
      stageRadius: 10,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      progressText: '{{current}} of {{total}}',
      steps: steps.map((s) => ({
        element: s.selector,
        popover: { title: s.title, description: s.body },
      })),
    })
    d.drive()
  }, [])

  return <HelpButton articles={articles} onStartTour={startTour} />
}
