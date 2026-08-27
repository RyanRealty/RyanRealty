/**
 * /dev/* — the prototype surface, and the one rule that keeps it off the public
 * internet.
 *
 * WHAT WAS OPEN. Seven routes answered HTTP 200 to anyone on ryan-realty.com:
 * /dev/animated-map, /dev/components, and the five /dev/public-v3 pages. They
 * are noindex and app/robots.ts disallows /dev/, so this was never an SEO
 * defect — it was reach. /dev/animated-map ran getAnimatedSalesMapData live on
 * every anonymous request, and the five /dev/public-v3 pages are build-time
 * prerendered with real MLS rows baked into publicly CDN-cached HTML.
 *
 * WHY THE GATE IS NOT IN THE PAGES. app/loading.tsx wraps every route, so React
 * flushes the shell — and HTTP 200 with it — before any page component
 * resolves. A page-body notFound() or a requireAdminPage() redirect lands after
 * that and can no longer set a status. /dev/components is the proof: its
 * notFound() DOES fire, and production still served 200 with 58,862 bytes of
 * shell and a "Component gallery" title. Same mechanism as
 * scripts/check-streamed-redirect.mjs and ListingUnavailable.tsx. Middleware
 * runs before render AND before the CDN hands back a prerendered page, so it is
 * the only place one rule can refuse all seven with a real status.
 *
 * WHY NODE_ENV AND NOT NEXT_PUBLIC_VERCEL_ENV. A preview deployment is a public
 * URL. NEXT_PUBLIC_VERCEL_ENV reports 'preview' there, and treating that as
 * non-production would leave the same pages open behind a longer hostname.
 * NODE_ENV is 'development' only on a developer's own machine.
 *
 * FAIL CLOSED. The predicate refuses unless NODE_ENV is exactly 'development',
 * so an unset or unexpected value refuses rather than opens.
 */

/** True for /dev and everything under it. Never for a route that merely shares the prefix. */
export function isDevOnlyPath(pathname: string): boolean {
  return pathname === '/dev' || pathname.startsWith('/dev/')
}

/**
 * The middleware decision. `nodeEnv` is passed in rather than read here so the
 * matrix is testable: Next inlines process.env.NODE_ENV into the edge bundle at
 * compile time, which makes it unreadable from a test.
 */
export function shouldRefuseDevRoute(pathname: string, nodeEnv: string | undefined): boolean {
  return isDevOnlyPath(pathname) && nodeEnv !== 'development'
}

/** The refusal body. Self-contained HTML: middleware cannot render a React tree. */
export const DEV_NOT_FOUND_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="robots" content="noindex, nofollow"><title>Page not found · Ryan Realty</title></head>' +
  '<body style="font-family:Geist,system-ui,sans-serif;background:#102742;color:#faf8f4;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center">' +
  '<div style="max-width:32rem;padding:2rem"><h1 style="font-size:2rem;margin:0 0 .75rem">Page not found</h1>' +
  '<p style="opacity:.8;line-height:1.6;margin:0 0 1.5rem">There is no page at this address.</p>' +
  '<a href="/" style="color:#faf8f4;text-decoration:underline">Go to the homepage</a></div></body></html>'
