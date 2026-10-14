'use client'

/**
 * view_landing_page, once per landing-page view, on every live landing page:
 * /sell, /sell/valuation, /sell/expired-listings, /sell/for-sale-by-owner and
 * each /buy/<slug> page that exists (Matt 2026-10-09: rebuild the GA4
 * landing-page audiences on /sell and /buy). The "LP visitors" audiences in
 * scripts/ga4-admin.mjs are built on this event. liveLandingVariant gives the
 * PAGE variant the LP leaderboard reads, and nothing for a 404 such as
 * /buy/xyz or /lp/foo, so GA4 and the session reports agree on what a landing
 * page is and a dead link never joins an audience.
 *
 * Mounted once, site-wide, in PublicClientLayer (never on /admin). No page fires
 * the event itself, so each opening of a landing page counts once.
 */
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { liveLandingVariant } from '@/lib/analytics/lp-variant'
import { trackLandingPageView } from '@/lib/tracking'

export default function LandingPageViewTracker() {
  const pathname = usePathname()
  useEffect(() => {
    const variant = liveLandingVariant(pathname)
    if (variant) trackLandingPageView(variant)
  }, [pathname])
  return null
}
