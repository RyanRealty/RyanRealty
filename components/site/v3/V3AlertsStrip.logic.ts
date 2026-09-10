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
  if (!stickyEligible(state, status)) return false
  if (state.calloutVisible) return false
  if (state.footerVisible) return false
  return true
}

/**
 * THE STRIP CAN COME BACK, so the page keeps its room. Eligibility drops the
 * two conditions that flip on every scroll — the callout on screen, the footer
 * on screen — and keeps the three that hold for the rest of the visit. The page
 * root reserves the strip's height while this is true rather than while it is
 * VISIBLE, because a reservation that appears and disappears at the foot of the
 * page is a jump of the strip's own height, every time the footer arrives.
 */
export function stickyEligible(state: V3AlertsStickyState, status: V3AlertsStatus): boolean {
  if (state.dismissed) return false
  if (status === 'sent') return false
  return state.passed
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

/**
 * THE STRIP'S ASK IS CLOSED when its field renders no box at all — the narrow
 * layout's resting state, where the stylesheet takes the field out of the flow
 * and the one control's job is to open it (V3AlertsStrip.client.tsx).
 *
 * The field's own geometry is the test, never a breakpoint copied out of the
 * stylesheet into JS: two copies of a media query drift the day one of them
 * moves, and `matchMedia` read during render is a hydration mismatch. A missing
 * field reads as closed for the same reason — there is nothing to submit.
 */
export function stickyAskClosed(field: { getClientRects(): { length: number } } | null | undefined): boolean {
  if (!field) return true
  return field.getClientRects().length === 0
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

export type V3AlertsTypeKey = string

export type V3AlertsTypeOption<T extends { key: string } = { key: string }> = T

/** The selected type, or the first option, or null when the place has none. */
export function selectAlertType<T extends { key: string }>(
  types: readonly T[] | null | undefined,
  key: string | null | undefined,
): T | null {
  if (!types || types.length === 0) return null
  if (key) {
    const match = types.find((type) => type.key === key)
    if (match) return match
  }
  return types[0] ?? null
}
