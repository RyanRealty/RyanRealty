'use client'

import { useEffect } from 'react'

/**
 * Locks document scroll while the /search app-frame (split or map view) is
 * active, so the page can never scroll past the viewport-fit shell into the
 * footer/newsletter band underneath it — those stay reachable in list view,
 * which renders normal scrollable document flow instead of the app frame.
 */
export function SplitViewBodyLock({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return
    // document.scrollingElement is <html> in standards mode, not <body> — an
    // overflow lock on body alone left the page scrollable via the html
    // element (verified live: htmlOverflow stayed "visible" with the page
    // still scrolling past the frame). Lock both.
    const { body, documentElement } = document
    const previousBodyOverflow = body.style.overflow
    const previousHtmlOverflow = documentElement.style.overflow
    body.style.overflow = 'hidden'
    documentElement.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousBodyOverflow
      documentElement.style.overflow = previousHtmlOverflow
    }
  }, [active])

  return null
}
