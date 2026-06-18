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
// KB design-system routes that render their OWN KbNav + KbFooter. The default
// SiteHeader/SiteFooter must be suppressed for these or the page double-renders
// chrome (two <header>/<footer> — Matt report 2026-06-18). Derived from the exact
// set of app/**/page.tsx that contain `kb-root` (Phase 9 site-wide KB migration).
// NOT-yet-KB siblings are deliberately ABSENT so they keep the default chrome:
//   /search(+/[...slug]), /sell/[intent], /buy/[intent], /housing-market/explore,
//   /housing-market/reports*, /listing/by-address|by-key, /reports/[slug]/[geoName],
//   /team/[slug]/edit, and the internal/legal/auth surfaces.
const KB_ROUTES: RegExp[] = [
  /^\/about$/,
  /^\/activity$/,
  /^\/area-guides$/,
  /^\/blog(\/[^/]+)?$/,
  /^\/buy(\/[^/]+)?$/, // /buy + /buy/<intent> lead landing (KB)
  /^\/cities(\/[^/]+(\/[^/]+)?)?$/, // /cities, /cities/<slug>, /cities/<slug>/<neighborhood>
  /^\/communities(\/[^/]+)?$/, // /communities, /communities/<slug>
  /^\/compare$/,
  /^\/contact$/,
  /^\/faq$/,
  /^\/guides(\/[^/]+)?$/,
  /^\/join$/,
  /^\/listing\/[^/]+$/, // /listing/<key>; NOT /listing/by-address|by-key/* (2+ segments)
  /^\/motivated-sellers(\/[^/]+)?$/,
  /^\/open-houses(\/[^/]+)?$/,
  /^\/our-homes$/,
  /^\/parks(\/[^/]+)?$/,
  /^\/price-drops(\/[^/]+)?$/,
  /^\/pulse$/,
  /^\/reports$/,
  /^\/reports\/[^/]+$/, // /reports/<slug> + /reports/explore; NOT /reports/<slug>/<geoName> (2 segments)
  /^\/reports\/sales\/[^/]+\/[^/]+$/,
  /^\/resources$/,
  /^\/reviews$/,
  /^\/schools(\/[^/]+)?$/,
  /^\/sell(\/[^/]+)?$/, // /sell + /sell/valuation + /sell/<intent> lead landing (KB)
  /^\/subdivisions\/[^/]+$/,
  /^\/team(\/[^/]+)?$/, // /team, /team/<slug>; NOT /team/<slug>/edit (2 segments)
  /^\/tools\/[^/]+$/,
  /^\/videos$/,
  /^\/zip\/[^/]+$/,
]

export function HideChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (!pathname) return <>{children}</>
  // Non-public surfaces that carry their own chrome (or none).
  if (pathname === "/") return null
  if (pathname.startsWith("/lp/")) return null
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null
  if (pathname.startsWith("/sign/")) return null
  if (pathname.startsWith("/concept/")) return null
  // Housing-market hub + region report + city reports + explore + reports archive
  // (all KB). The only /housing-market surface that keeps default chrome is the
  // legacy 2-segment /housing-market/<city>/<subdivision> report.
  if (pathname === "/housing-market") return null
  if (/^\/housing-market\/[^/]+$/.test(pathname)) return null // 1-segment: region, city reports, explore, reports
  if (/^\/housing-market\/reports\/[^/]+$/.test(pathname)) return null // /housing-market/reports/<slug> detail
  // Every other KB design-system route.
  if (KB_ROUTES.some((re) => re.test(pathname))) return null
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
