'use client'

/**
 * Shot triggers (data-taste buttons) exist so take-route-shots can force the
 * error, success, sent and hours-empty states. They are opacity 0 but were
 * still in the tab order and the accessibility tree, so a keyboard or
 * screen-reader visitor could reach "Show sent" and see "Message received"
 * on an empty form (UX review 2026-10-15, F01).
 *
 * Render them only for an automated browser (navigator.webdriver, the same
 * automation signal lib/analytics/automation.ts uses). Playwright sets it, so
 * the shot tool keeps working; a person's browser never does.
 */
import { useEffect, useState } from 'react'

export function isAutomatedBrowser(nav: { webdriver?: boolean } | undefined): boolean {
  return nav?.webdriver === true
}

export function useShotTriggers(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(isAutomatedBrowser(typeof navigator === 'undefined' ? undefined : navigator))
  }, [])
  return on
}
