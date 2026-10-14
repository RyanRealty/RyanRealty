'use client'

/**
 * view_landing_page, once per landing-page view, on every path lpVariantFromPath
 * names: /sell, /sell/valuation, /sell/expired-listings, /sell/for-sale-by-owner
 * and /buy/<intent> (Matt 2026-10-09: rebuild the GA4 landing-page audiences on
 * /sell and /buy). The "LP visitors" audiences in scripts/ga4-admin.mjs are
 * built on this event. The variant is the PAGE variant the LP leaderboard reads
 * through the same function, so GA4 and the session reports agree on what a
 * landing page is.
 *
 * Mounted once, site-wide, in PublicClientLayer (never on /admin). No page fires
 * the event itself, so a landing page counts one view per visit to it.
 */
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { lpVariantFromPath } from '@/lib/analytics/lp-variant'
import { trackLandingPageView } from '@/lib/tracking'

export default function LandingPageViewTracker() {
  const pathname = usePathname()
  useEffect(() => {
    const variant = lpVariantFromPath(pathname)
    if (variant) trackLandingPageView(variant)
  }, [pathname])
  return null
}
