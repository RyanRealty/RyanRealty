'use client'

/**
 * Scrolls the sub-nav's current tab into view on mount. The tab row hides its
 * scrollbar, so without this a phone lands on e.g. Calls with the active tab
 * off-screen and no cue it exists. Mounted inside the scroll container; finds
 * it via the ref's parent so the server component stays a server component.
 */
import { useEffect, useRef } from 'react'

export function ScrollActiveIntoView() {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const scroller = ref.current?.parentElement
    const active = scroller?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!scroller || !active) return
    // Rect math, not offsetLeft — the scroller is not the offsetParent, so
    // offsetLeft is in an ancestor's coordinate space (off by the page padding).
    const pad = 16
    const a = active.getBoundingClientRect()
    const s = scroller.getBoundingClientRect()
    const clippedLeft = a.left < s.left
    const clippedRight = a.right > s.right
    // Only move if the tab is actually clipped; never animate (calm motion).
    if (clippedLeft || clippedRight) {
      scroller.scrollLeft = Math.max(0, scroller.scrollLeft + (a.left - s.left) - pad)
    }
  }, [])

  return <span ref={ref} hidden />
}
