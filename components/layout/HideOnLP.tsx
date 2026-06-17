"use client"

/**
 * HideOnLP — client-side route gate that hides public chrome on /lp/* and
 * /admin routes. Admin carries its own header + nav (AdminHeader,
 * AdminSidebar/AdminMobileNav); stacking the public SiteHeader above it
 * double-spent ~140px of phone viewport and put two hamburgers on screen
 * (fixed 2026-06-10, Matt report).
 *
 * We can't use `headers()` in the root layout for LP detection: that call
 * forces the entire route tree to render dynamically, which prevents the
 * static prerender for the public LP families (cities, communities, zip,
 * listing detail). The prerender block was the root cause of the cold
 * cache p95 spikes flagged by SITE_SPEC §45-47.
 *
 * Trade-off: the chrome HTML still ships in the RSC payload for LP routes
 * and unmounts on hydration. The brief flash is acceptable because LP
 * routes are conversion-focused and never the LCP candidate.
 */

import { usePathname } from "next/navigation"

export default function HideOnLP({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/lp/")) return null
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null
  // /sign/* is a focused, distraction-free e-signature surface for clients —
  // no marketing nav, no "Sign in" prompt, no footer. It carries its own
  // minimal Ryan Realty branding (see components/tc/pdf-sign/SignFlow.tsx).
  if (pathname?.startsWith("/sign/")) return null
  // /concept/* — KB design-preview surfaces carry their own KB chrome (KbNav +
  // the KB footer section); the default site header/footer would double up.
  if (pathname?.startsWith("/concept/")) return null
  return <>{children}</>
}

/**
 * HideChrome — like HideOnLP, but ALSO hides on the homepage "/". The homepage
 * is the kinetic-brutalist design and carries its own chrome (KbNav + the KB
 * footer section), so the default SiteHeader / SiteFooter would double up.
 *
 * Use this ONLY for the header + footer. Everything else the layout wraps in
 * HideOnLP (the site-wide JSON-LD, VisitTracker, auth bridges, skip-link) MUST
 * keep running on the homepage — it is the highest-traffic page — so those stay
 * on plain HideOnLP, which does NOT hide "/".
 */
export function HideChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/") return null
  if (pathname?.startsWith("/lp/")) return null
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null
  if (pathname?.startsWith("/sign/")) return null
  if (pathname?.startsWith("/concept/")) return null
  return <>{children}</>
}

/** Inverse: show only on /lp/* routes. */
export function OnLPOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (!pathname?.startsWith("/lp/")) return null
  return <>{children}</>
}

/**
 * Hide on /admin only (unlike HideOnLP, children still render on /lp/*).
 * Used to keep the analytics/pixel/ads stack off admin: broker usage was
 * firing GA4 sessions, Meta PageViews, and AdSense requests on every admin
 * page — wasted bytes AND scoreboard pollution (admin traffic inflated the
 * very GA4 metrics THE LOOP's diagnose step reads). Fixed 2026-06-10.
 */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null
  return <>{children}</>
}
