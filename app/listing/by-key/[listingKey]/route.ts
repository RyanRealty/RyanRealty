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
 * set a real Location header. Neither middleware nor next.config.ts can do this
 * hop: it needs a listings lookup.
 *
 * BRANCHES
 *   row found  -> 308 to the canonical /homes-for-sale/<city>/<slug>-<mls> URL.
 *   no row     -> 307 to /listing/<key>, which renders the ListingUnavailable
 *                 refusal (h1 + robots noindex). Temporary, not permanent: a
 *                 Coming Soon or opted-out row can become displayable later.
 *                 Reusing that page keeps ONE refusal surface — no second copy
 *                 of the "may no longer be on the market" body to drift.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getListingCanonicalPathFields } from '@/lib/data/listings/getListingCanonicalPathFields'
import { listingDetailPath, listingKeyFromSlug } from '@/lib/slug'

function canonicalPathFromFields(
  row: NonNullable<Awaited<ReturnType<typeof getListingCanonicalPathFields>>>,
): string {
  return listingDetailPath(
    row.ListingKey,
    {
      streetNumber: row.StreetNumber,
      streetName: row.StreetName,
      city: row.City,
      state: row.State,
      postalCode: row.PostalCode,
    },
    {
      city: row.boundary_city ?? row.City,
      neighborhood: row.boundary_neighborhood,
      subdivision: row.SubdivisionName,
    },
    { mlsNumber: row.ListNumber },
  )
}

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
 * Build the redirect target off `request.nextUrl`, the same source middleware.ts
 * uses. `new URL(path, request.url)` would take the origin from `request.url`,
 * which behind a proxy can be the internal deployment host — a Location header
 * pointing somewhere the visitor cannot follow.
 */
function to(request: NextRequest, pathname: string): URL {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  url.hash = ''
  return url
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ listingKey: string }> },
) {
  const { listingKey } = await context.params
  const row = await lookupPathFields(listingKey)
  if (!row) {
    return NextResponse.redirect(to(request, `/listing/${String(listingKey ?? '').trim()}`), 307)
  }
  return NextResponse.redirect(to(request, canonicalPathFromFields(row)), 308)
}
