/**
 * chrome-routes — the single source of truth for which routes suppress the
 * default site chrome (SiteHeader + SiteFooter). Pure functions of the pathname,
 * with NO client/next dependencies, so they can be unit-tested and reused by both
 * the client gate (components/layout/HideOnLP.tsx → HideChrome) and any future
 * server-side check.
 *
 * A route "hides default chrome" when it carries its OWN chrome (the KB nav +
 * footer) or none at all (LP, admin, sign, concept). Rendering the default
 * SiteHeader on top of a KB nav double-renders chrome — the "double nav" class of
 * bug (Matt reports 2026-06-18, 2026-07-11).
 */

// KB design-system routes that render their OWN KbNav + KbFooter. The default
// SiteHeader/SiteFooter must be suppressed for these. Derived from the exact set
// of app/**/page.tsx that contain `kb-root` (Phase 9 site-wide KB migration).
// NOT-yet-KB siblings are deliberately ABSENT so they keep the default chrome:
//   /homes-for-sale(+/<city>/<filters>) search, /housing-market/<city>/<sub>,
//   /listing/by-address|by-key, /reports/<slug>/<geoName>, /team/<slug>/edit,
//   and the internal/legal/auth surfaces.
export const KB_ROUTES: RegExp[] = [
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

/**
 * True on routes that carry their own chrome (or none) and must therefore SHOW
 * neither the default SiteHeader nor SiteFooter.
 *
 * When the pathname is unknown (static prerender before hydration) this returns
 * false (default: show chrome) — matching the historical null-guard behavior.
 */
export function shouldHideDefaultChrome(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  // Non-public surfaces that carry their own chrome (or none).
  if (pathname === "/") return true
  if (pathname.startsWith("/lp/")) return true
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true
  if (pathname.startsWith("/sign/")) return true
  if (pathname.startsWith("/concept/")) return true
  // Housing-market hub + region report + city reports + explore + reports archive
  // (all KB). The only /housing-market surface that keeps default chrome is the
  // legacy 2-segment /housing-market/<city>/<subdivision> report.
  if (pathname === "/housing-market") return true
  if (/^\/housing-market\/[^/]+$/.test(pathname)) return true // 1-segment: region, city reports, explore, reports
  if (/^\/housing-market\/reports\/[^/]+$/.test(pathname)) return true // /housing-market/reports/<slug> detail
  // Listing detail. The canonical browser URL is /homes-for-sale/<city>/<address>
  // (or /homes-for-sale/listing/<key>), which rewrites to app/listing/* — the KB
  // shell. Match the listing-detail slug shapes (last segment ends in a -<5+ digit
  // MLS number> or contains ~, or the /listing/<key> form). Does NOT match the
  // search URLs (/homes-for-sale, /homes-for-sale/<city>, …/<filters>).
  if (/^\/homes-for-sale\/listing\/[^/]+$/.test(pathname)) return true
  if (/^\/homes-for-sale\/.+(-\d{5,}|~[^/]*)\/?$/.test(pathname)) return true
  // Every other KB design-system route.
  if (KB_ROUTES.some((re) => re.test(pathname))) return true
  return false
}
