import { V3Loading } from '@/components/site/v3'

/**
 * Streaming fallback for the ROOT segment — every route in the app, public
 * and admin alike, shows this first before its own (shorter, route-specific)
 * loading.tsx or real content replaces it (SITE-158).
 *
 * WHY NOT A HOMEPAGE SKELETON. This file used to draw a five-section,
 * ~2,900px fake homepage (hero + featured row + just-listed row + community
 * grid + market CTA + trust/email) on EVERY route, including ones whose real
 * content — or whose OWN loading.tsx — is far shorter. Next.js streams the
 * root boundary's fallback first regardless of which route is loading, so a
 * visitor on /cities/bend got a ~2,900px document for ~1s, then watched it
 * collapse to the route's own ~966px skeleton the instant that boundary
 * resolved. A document that shrinks out from under a mid-load scroll is what
 * the browser clamps `scrollY` against — that clamp is the "moves the middle
 * of the page to the top" bug Matt reported. A fallback shorter than the page
 * replacing it only ever GROWS the document, which does not clamp anything.
 *
 * WHY THIS SHAPE. The root fallback cannot know which route is loading, so it
 * must not pretend to (no hero, no cards, no grid shaped like the homepage).
 * V3Loading is the design system's existing answer to exactly that problem —
 * nine other routes (about, blog, compare, contact, forgot-password, login,
 * sell, signup, team) already use it as an honest "text is coming" shell that
 * reserves the v3 section measure/gutter/pad without claiming a layout it
 * has not seen. It renders under 500px, well under every nested loading.tsx
 * and every real page's content, so the boundary handoff can only grow the
 * document, never shrink it.
 */
export default function Loading() {
  return <V3Loading label="Loading Ryan Realty" lines={3} />
}
