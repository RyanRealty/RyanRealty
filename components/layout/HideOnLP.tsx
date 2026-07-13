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
import { shouldHideDefaultChrome } from "@/lib/site/chrome-routes"

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
 *
 * The route predicate lives in @/lib/site/chrome-routes (pure, unit-tested).
 *
 * DO NOT toggle the header's MOUNT STATE (returning `null` vs `children`). That
 * pattern raced during App Router soft-navigation and mid-deploy hydration skew
 * and left a STALE duplicate <header> in the DOM — the "double nav" Matt reported
 * 2026-07-11 (two identical navy SiteHeaders stacked on /homes-for-sale). The
 * SiteHeader is an async server component whose HTML always ships in the RSC
 * payload; unmounting it on hydration is exactly the add/remove that duplicates.
 *
 * Instead keep a STRUCTURALLY STABLE wrapper node that is never added or removed,
 * and toggle visibility with CSS. `display: contents` when shown means the wrapper
 * generates no box, so the child <header>'s `position: sticky` behaves exactly as
 * if the wrapper weren't there; `display: none` when hidden removes it from the
 * render tree without unmounting. React only flips one inline style on a stable
 * node — it can never duplicate the element.
 */
export function HideChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hide = shouldHideDefaultChrome(pathname)
  return (
    <div data-chrome-gate style={{ display: hide ? "none" : "contents" }}>
      {children}
    </div>
  )
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
