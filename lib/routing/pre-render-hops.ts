/**
 * Pre-render hops — every URL consolidation that must emit a real 3xx and
 * therefore cannot live in a page body.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE
 * ------------------------------------
 * A `loading.tsx` opens a Suspense boundary. When anything above or inside it
 * suspends, React flushes the shell — HTTP 200 and the response headers with it
 * — before the page component finishes. A `redirect()` thrown afterwards can no
 * longer write a `Location` header, so Next degrades it to an RSC flight
 * instruction: a browser with JS completes the hop, a crawler is served a 200
 * with layout chrome and no <h1>. `app/loading.tsx` wraps EVERY route on this
 * site, so no page-body redirect can be trusted to emit a status.
 *
 * Two mechanisms sit above the render and CAN set a status:
 *   - next.config.ts `redirects()` — for hops that are a pure path rewrite.
 *   - middleware.ts — for hops that need a lookup or a slug transform.
 *
 * This module is the second one. Each entry pairs the resolver middleware runs
 * with the app-router page paths whose in-body redirect it supersedes, so the
 * two can never drift apart: scripts/check-streamed-redirect.mjs reads `routes`
 * from here and asserts middleware.ts calls `resolvePreRenderHop`.
 *
 * Every resolver is pure, synchronous and Edge-safe: committed JSON and string
 * work only, no DB, no async.
 */

import { resolveCanonicalCommunityPath } from '@/lib/communities/canonical-community-slug'
import { resolveLegacyReportGeoRedirect } from '@/lib/routing/legacy-report-geo'
import {
  resolveNeighborhoodAliasRedirect,
  resolveSubdivisionAreaRedirect,
} from '@/lib/subdivision-area-redirects'

export type PreRenderHop = {
  /** Short name, used in the gate's output. */
  readonly id: string
  /** app-router page paths this hop covers (route shape, not a URL). */
  readonly routes: readonly string[]
  /** Destination path for a request pathname, or null when it does not apply. */
  readonly resolve: (pathname: string) => string | null
}

/** Decode one URL segment, falling back to the raw text on a malformed escape. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export const PRE_RENDER_HOPS: readonly PreRenderHop[] = [
  {
    // A resort has ONE canonical URL: its bare registry slug. Compound slugs
    // (/communities/bend-broken-top) and wrong-city slugs
    // (/communities/bend-crosswater) consolidate onto it. 91 of the 104
    // registry-derived compound slugs served an indexable 200 with zero <h1>
    // before this hop existed (measured on production 2026-08-19).
    id: 'community-canonical-slug',
    routes: ['/communities/[slug]'],
    resolve(pathname) {
      const m = pathname.match(/^\/communities\/([^/]+)\/?$/)
      if (!m) return null
      return resolveCanonicalCommunityPath(decodeSegment(m[1]))
    },
  },
  {
    // /subdivisions/[slug] serves PLAT slugs. A MARKETING-level area name
    // ('awbrey-butte', 'tetherow') has no plat boundary, so the page notFound()s
    // — which streams as a hollow 200. Resolution is a synchronous lookup in a
    // committed-JSON map; the ~3,213 real plats are not in it and pass through.
    id: 'subdivision-marketing-area',
    routes: ['/subdivisions/[slug]'],
    resolve(pathname) {
      const m = pathname.match(/^\/subdivisions\/([^/]+)\/?$/)
      if (!m) return null
      return resolveSubdivisionAreaRedirect(decodeSegment(m[1]))
    },
  },
  {
    // Bend-district alias. Live reports live at /cities/bend/{slug}.
    id: 'neighborhood-alias',
    routes: ['/neighborhoods/[slug]'],
    resolve(pathname) {
      const m = pathname.match(/^\/neighborhoods\/([^/]+)\/?$/)
      if (!m) return null
      return resolveNeighborhoodAliasRedirect(decodeSegment(m[1]))
    },
  },
  {
    // Legacy per-geo market report — read a dropped table, printed an unsourced
    // verdict, and duplicated the live market page. next.config.ts was 308-ing
    // the /reports family straight into its blank shell.
    id: 'legacy-report-geo',
    routes: ['/reports/[slug]/[geoName]', '/housing-market/reports/[slug]/[geoName]'],
    resolve: resolveLegacyReportGeoRedirect,
  },
]

/** Every app-router page path covered by a middleware-owned hop. */
export const PRE_RENDER_HOP_ROUTES: readonly string[] = PRE_RENDER_HOPS.flatMap((h) => h.routes)

/**
 * The single entry point middleware calls. Returns the destination path for the
 * first hop that claims this pathname, or null.
 */
export function resolvePreRenderHop(pathname: string): string | null {
  for (const hop of PRE_RENDER_HOPS) {
    const dest = hop.resolve(pathname)
    if (dest && dest !== pathname) return dest
  }
  return null
}
