/**
 * chrome-routes — which routes suppress the default site chrome.
 *
 * CORRECTED 2026-08-27. This file still described a world where pages carried
 * "their OWN KbNav + KbFooter" and the default `SiteHeader` had to be kept off
 * them. None of that exists any more: `SiteHeader` and `KbNav` are deleted, the
 * ONE public header is `V3Chrome` mounted in `app/layout.tsx`, and every public
 * page owns its footer (`V3Footer`, held by ci:chrome-single-source). The list
 * below is no longer "KB routes"; it is simply the set of paths that must not
 * receive a default-chrome node.
 *
 * Its ONE consumer is `HideChrome` in components/layout/HideOnLP.tsx, which
 * `app/not-found.tsx` uses so a 404 landing on an LP or admin path does not
 * paint a public footer. Pure functions of the pathname, no client/next
 * dependency, unit-tested in ./chrome-routes.test.ts.
 *
 * OPEN QUESTION, recorded rather than silently changed: the list still names
 * ordinary public routes (/about, /cities, …). Under the old model those pages
 * rendered their own chrome, so suppressing the default was right. Today they
 * are all route-owned anyway, so those entries are inert for the footer case and
 * only matter to a 404 on such a path. Narrowing the list is a behaviour change
 * and belongs in its own commit with its own verification.
 */

// Routes that must not receive a default-chrome node. The name KB_ROUTES is kept
// because the exported symbol is asserted by ./chrome-routes.test.ts; the set is
// what it always was, derived from the pages that owned their own chrome. Absent
// siblings deliberately keep the default:
//   /homes-for-sale(+/<city>/<filters>) search, /housing-market/<city>/<sub>,
//   /listing/by-address|by-key, /reports/<slug>/<geoName>, /team/<slug>/edit,
//   and the internal/legal/auth surfaces.
export const KB_ROUTES: RegExp[] = [
  /^\/about$/,
  /^\/activity$/,
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
  /^\/reports\/[^/]+$/, // /reports/<slug> + /reports/explore; NOT /reports/<slug>/<geoName> (2 segments)
  /^\/reports\/sales\/[^/]+\/[^/]+$/,
  /^\/reviews$/,
  /^\/schools(\/[^/]+)?$/,
  /^\/sell(\/[^/]+)?$/, // /sell + /sell/valuation + /sell/<intent> lead landing (KB)
  /^\/site-index$/, // crawlable site directory (W3.4 internal-link layer, KB)
  /^\/subdivisions\/[^/]+$/,
  /^\/team(\/[^/]+)?$/, // /team, /team/<slug>; NOT /team/<slug>/edit (2 segments)
  /^\/tools\/[^/]+$/,
  /^\/videos$/,
  /^\/zip\/[^/]+$/,
  /^\/central-oregon\/(venues|trails|events|golf)(\/[^/]+)?$/,
  /^\/luxury-homes-bend$/,
  /^\/oregon\/[^/]+$/,
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
  if (/^\/housing-market\/reports\/archive\/[^/]+$/.test(pathname)) return true
  // Listing detail. The canonical browser URL is /homes-for-sale/<city>/<address>
  // (or /homes-for-sale/listing/<key>), which rewrites to app/listing/* — the KB
  // shell. Match the listing-detail slug shapes (last segment ends in a -<5+ digit
  // MLS number> or contains ~, or the /listing/<key> form). Does NOT match the
  // search URLs (/homes-for-sale, /homes-for-sale/<city>, …/<filters>).
  if (/^\/homes-for-sale\/listing\/[^/]+$/.test(pathname)) return true
  if (/^\/homes-for-sale\/.+(-\d{5,}|~[^/]*)\/?$/.test(pathname)) return true
  // design-audit NAV-1: EVERY /homes-for-sale surface now renders KbNav (solid)
  // as the single site nav — the index (/homes-for-sale) and the city-form pages
  // (/homes-for-sale/<city>[/<filters>]) via app/search/layout.tsx, and listing
  // detail (matched above) via app/listing. So suppress the default SiteHeader/
  // SiteFooter across the whole /homes-for-sale/** tree. The buyer funnel is one nav.
  if (pathname === "/homes-for-sale" || pathname.startsWith("/homes-for-sale/")) return true
  // Every other KB design-system route.
  if (KB_ROUTES.some((re) => re.test(pathname))) return true
  return false
}
