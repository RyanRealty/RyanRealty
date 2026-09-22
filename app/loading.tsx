import { V3Loading } from '@/components/site/v3'

/**
 * Streaming fallback for the ROOT segment. Every route shows this first
 * before its own loading.tsx or the real page replaces it (SITE-158 / SITE-155).
 *
 * WHY NOT A HOMEPAGE SKELETON. This file used to draw a five-section,
 * ~2,900px fake homepage on EVERY route. Next streams the root fallback
 * first, so a visitor on /cities/bend got a ~2,900px document, then watched
 * it collapse to the route's own ~900px skeleton. A document that shrinks
 * out from under a mid-load scroll is what the browser clamps scrollY
 * against — that clamp is the "moves the middle of the page to the top"
 * jump. A fallback shorter than the page that replaces it only ever GROWS
 * the document, which does not clamp.
 *
 * V3Loading is the design system's compact "text is coming" shell (blog,
 * compare, contact, login, sell, signup, team already use it). It cannot
 * know which route is loading, so it does not pretend to.
 */
export default function Loading() {
  return <V3Loading label="Loading Ryan Realty" lines={3} />
}
