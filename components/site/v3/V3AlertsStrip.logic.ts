/**
 * The pure half of V3AlertsStrip: when the sticky repeat is allowed on screen,
 * how one observer entry reads as "the visitor is past the anchor", and the
 * cheap email check that lets the callout answer before the round trip.
 *
 * Kept out of the client file so the rules can be tested without a DOM. Nothing
 * here formats a figure or reads the page (components/site/v3/index.ts).
 */

export type V3AlertsStatus = 'idle' | 'sending' | 'sent' | 'failed'

export type V3AlertsStickyState = {
  /** The anchor section (the Atlas) has scrolled fully above the viewport. */
  passed: boolean
  /** The callout itself is on screen, so a repeat would be a duplicate. */
  calloutVisible: boolean
  /** The footer is on screen; the strip never covers the closing row. */
  footerVisible: boolean
  /** The visitor closed the strip this session. */
  dismissed: boolean
}

export const V3_ALERTS_STICKY_INITIAL: V3AlertsStickyState = {
  passed: false,
  calloutVisible: false,
  footerVisible: false,
  dismissed: false,
}

/**
 * The strip shows only when every condition holds: the visitor is past the
 * anchor, the callout is off screen, the footer is off screen, nobody closed
 * it, and nothing has been sent. Order does not matter; every reason to hide
 * wins on its own.
 */
export function stickyVisible(state: V3AlertsStickyState, status: V3AlertsStatus): boolean {
  if (state.dismissed) return false
  if (status === 'sent') return false
  if (!state.passed) return false
  if (state.calloutVisible) return false
  if (state.footerVisible) return false
  return true
}

/**
 * "Past the anchor" means the anchor's bottom edge is above the top of the
 * viewport: not intersecting AND above, never not-intersecting-because-below.
 */
export function anchorPassed(entry: {
  isIntersecting: boolean
  boundingClientRect: { bottom: number }
}): boolean {
  return !entry.isIntersecting && entry.boundingClientRect.bottom <= 0
}

/** The same shape the capture action accepts, so the callout never sends what the server refuses. */
export function isPlausibleEmail(value: string): boolean {
  const email = value.trim()
  if (email.length === 0 || email.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** The sessionStorage key a dismissal writes. One per page id so two strips on one site do not share a close. */
export function stickyDismissKey(id: string): string {
  return `v3-alerts-strip:${id}:dismissed`
}
