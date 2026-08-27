"use client"

/**
 * HideOnLP — client-side route gate that hides public chrome on /lp/* and
 * /admin routes. Admin carries its own header + nav (AdminHeader,
 * AdminSidebar/AdminMobileNav). The one public header (V3Chrome, mounted in
 * app/layout.tsx) also self-hides on those paths; HideOnLP still gates JSON-LD / skip-link /
 * client islands so LP and admin stay distraction-free
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
  // /concept/* — design-preview surfaces; hide marketing client islands
  // (PublicNav also self-hides on non-public shells via its own predicate).
  if (pathname?.startsWith("/concept/")) return null
  return <>{children}</>
}

/**
 * HideChrome — legacy CSS visibility gate (display: contents vs none).
 *
 * Dual-chrome kill (Matt 2026-08-10, corrected 2026-08-27): the single public
 * header is V3Chrome, mounted once in app/layout.tsx. SiteHeader and KbNav are
 * deleted. Pages must NOT mount a header at all; do not "fix double chrome" by
 * adding HideChrome around a second header — remove the second mount instead.
 * Held by ci:chrome-single-source.
 *
 * Still exported because app/not-found.tsx wraps V3Footer here (404s can
 * land on any pathname; the gate keeps the public footer off LP/admin
 * paths). shouldHideDefaultChrome in @/lib/site/chrome-routes remains the
 * predicate. Footers on real pages are route-owned
 * (scripts/check-default-chrome-footer.mjs) — never re-mount a global hidden
 * footer in layout.
 *
 * If anything ever re-wraps default chrome: keep a STRUCTURALLY STABLE
 * wrapper and toggle CSS only — never unmount on hydration (the 2026-07-11
 * double-header bug was mount-toggle of an async server header).
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
