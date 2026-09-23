/**
 * /listing/by-key/<key> — key → canonical pretty URL.
 *
 * A ROUTE HANDLER, NOT A PAGE, ON PURPOSE
 * ---------------------------------------
 * This was `page.tsx`, and it ended in `permanentRedirect(canonicalPath)` after
 * two awaits. Every route on this site renders inside the Suspense boundary
 * app/loading.tsx opens (this segment has its own loading.tsx too), so React had
 * already flushed the shell — HTTP 200 and the headers — before the redirect
 * threw. The throw could only be delivered as an RSC flight instruction.
 * Measured on ryan-realty.com 2026-08-19 (browser UA, redirect:manual):
 *
 *   /listing/by-key/20200228140308644050000000  ->  200, Location: null, 0 <h1>
 *   /listing/by-key/rr-smoke-no-such-listing    ->  200, refusal body, 1 <h1>
 *
 * The MISS branch was fine, so the route-smoke gate was green while the branch
 * that actually resolves a row served a blank page to every crawler and no-JS
 * client. That gap is why check-route-smoke.mjs now probes a RESOLVING key too.
 *
 * A route handler owns its whole response and never streams a shell, so it can
 * set a real Location header. next.config.ts cannot do this hop: it needs a
 * listings lookup. (middleware.ts now does one for the PRETTY paths, P14,
 * through lib/routing/listing-canonical-hop.ts; this key-form path stays here,
 * where unstable_cache keeps the lookup warm across instances.)
 *
 * BRANCHES
 *   row found  -> 308 to the canonical /homes-for-sale/<city>/<slug>-<mls> URL.
 *                 If that canonical is THIS key-form path (a row with no MLS
 *                 City), 307 to /listing/<key> instead: a hop that targets
 *                 itself is an infinite redirect.
 *   no row     -> 307 to /listing/<key>, which renders the ListingUnavailable
 *                 refusal (h1 + robots noindex). Temporary, not permanent: a
 *                 Coming Soon or opted-out row can become displayable later.
 *                 Reusing that page keeps ONE refusal surface — no second copy
 *                 of the "We can't show this home" body to drift.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getListingCanonicalPathFields } from '@/lib/data/listings/getListingCanonicalPathFields'
import { listingCanonicalPathFromFields } from '@/lib/data/listings/listingCanonicalPathCore'
import { listingKeyFromSlug } from '@/lib/slug'

async function lookupPathFields(listingKey: string) {
  const raw = String(listingKey ?? '').trim()
  if (!raw) return null
  const fromSlug = listingKeyFromSlug(raw)
  const first = await getListingCanonicalPathFields(fromSlug || raw)
  if (first) return first
  if (fromSlug && fromSlug !== raw) return getListingCanonicalPathFields(raw)
  return null
}

/**
 * Emit a ROOT-RELATIVE Location, the way middleware.ts and next.config.ts
 * redirects() already do on this site (production, 2026-08-20:
 * `/subdivisions/tetherow` -> `location: /communities/tetherow`;
 * `/reports` -> `location: /housing-market/reports`). RFC 7231 §7.1.2 allows a
 * relative reference and the client resolves it against the URL it asked for,
 * so the hop cannot land on a host the request never named.
 *
 * An absolute Location built here would not track the request. Measured on a
 * production build at :3140: `request.nextUrl.clone()` returned
 * `http://localhost:3140/...` for a request carrying `Host: ryan-realty.com`,
 * and `https://localhost:3140/...` once `x-forwarded-proto: https` was added —
 * a Location no visitor can follow. `new URL(path, request.url)` reads the same
 * origin. A relative header removes the question.
 */
function redirectTo(pathname: string, status: 307 | 308): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { location: pathname },
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ listingKey: string }> },
) {
  void request
  const { listingKey } = await context.params
  const row = await lookupPathFields(listingKey)
  const refusal = `/listing/${encodeURIComponent(String(listingKey ?? '').trim())}`
  if (!row) return redirectTo(refusal, 307)
  // SITE-22: one builder for the canonical and everything that points at it
  // (listingCanonicalHref, through the core both lookups share).
  const canonical = listingCanonicalPathFromFields(row)
  if (canonical.startsWith('/homes-for-sale/listing/')) return redirectTo(refusal, 307)
  return redirectTo(canonical, 308)
}
