/**
 * A listing the database cannot answer for is TEMPORARILY unavailable, and the
 * response has to say so in the status line (GSC slide fix, 2026-10-05).
 *
 * THE DEFECT
 * ----------
 * Until 7e392cc4 (2026-10-04) a failed listing lookup (statement timeout while
 * the listing view refreshed, or the Supabase gateway answering 503) rendered
 * "We can't show this home" as HTTP 200 with robots noindex. URL Inspection on
 * a random 150 of the 3,247 sitemap listing URLs (2026-10-05) found 12 still
 * "Excluded by 'noindex' tag", all crawled in one 09-05/09-06 burst, 8 of them
 * with a Google-selected canonical pointing at a DIFFERENT listing: every
 * failure page had the same body, so Google folded them together. 7e392cc4
 * removed the noindex, but the failure was still a 200 with one shared body,
 * which Google can still fold or index as a soft 404.
 *
 * THE FIX
 * -------
 * The page cannot set its own status: app/loading.tsx and the route's
 * loading.tsx flush the shell (HTTP 200) before the page body resolves
 * (ci:streamed-redirect). middleware.ts already reads every listing-detail
 * path's row at the edge for the canonical hop, from the same `listings` table
 * through the same anon PostgREST the page reads. When that read fails because
 * the database is not answering, middleware returns THIS response: 503,
 * Retry-After, no-store. Google treats a 503 as "come back later"; it keeps the
 * indexed copy and never merges or drops the URL on it.
 *
 * WHAT IS NEVER TOUCHED
 *   - A miss or a refused row (IDX opt-out, Coming Soon): no 503. The page
 *     renders its refusal exactly as before.
 *   - Off-market listings: they resolve, so they render the honest off-market
 *     state, index,follow (docs/MASTER_SPEC.md §4.9, ci:listing-offmarket-index).
 *   - A configuration fault (missing env, a 4xx): a retry cannot fix it, so it
 *     passes through and the page decides.
 *
 * The body carries no robots meta on purpose: a temporary failure must never
 * say noindex, in the status line or anywhere else.
 */
import { NextResponse } from 'next/server'
import type { EdgeCanonicalLookup, EdgeLookupOptions } from '@/lib/data/listings/getListingCanonicalPathFieldsEdge'

/** Seconds a crawler or browser should wait before asking again. */
export const LISTING_RETRY_AFTER_SECONDS = 120

/**
 * The retry read's ceiling. The first read keeps the hop's 1.5s budget (the
 * healthy read is ~100ms); only a read that already failed pays this, and it
 * matches the page's own 4s per-read ceiling (getListingDetail.ts), so a 503
 * means the page would not have rendered either.
 */
export const LISTING_RETRY_TIMEOUT_MS = 4_000

export type EdgeListingReader = (id: string, opts?: EdgeLookupOptions) => Promise<EdgeCanonicalLookup>

/**
 * The edge lookup for a request, with one retry when the first read failed
 * because the database did not answer. A healthy request costs one read, as
 * before; only a transient failure pays the second.
 */
export async function readListingForRequest(id: string, reader: EdgeListingReader): Promise<EdgeCanonicalLookup> {
  const first = await reader(id)
  if (!isListingLookupUnavailable(first)) return first
  return reader(id, { timeoutMs: LISTING_RETRY_TIMEOUT_MS })
}

/** True only when the database did not answer. A miss, a row or a config fault is false. */
export function isListingLookupUnavailable(lookup: EdgeCanonicalLookup): boolean {
  return lookup.kind === 'error' && lookup.transient
}

const LISTING_UNAVAILABLE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  `<meta http-equiv="refresh" content="${LISTING_RETRY_AFTER_SECONDS}"><title>This home is taking a moment to load · Ryan Realty</title></head>` +
  '<body style="font-family:Geist,system-ui,sans-serif;background:#102742;color:#faf8f4;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center">' +
  '<div style="max-width:32rem;padding:2rem"><h1 style="font-size:2rem;margin:0 0 .75rem">This home is taking a moment to load</h1>' +
  '<p style="opacity:.8;line-height:1.6;margin:0 0 1.5rem">Our listing data is slow to answer right now. Refresh in a minute and the home will be here.</p>' +
  '<a href="/homes-for-sale" style="color:#faf8f4;text-decoration:underline">Browse homes for sale</a></div></body></html>'

/** HTTP 503 + Retry-After + no-store, for a listing path whose lookup the database did not answer. */
export function listingTemporarilyUnavailableResponse(reason?: string): NextResponse {
  const headers: Record<string, string> = {
    'content-type': 'text/html; charset=utf-8',
    'retry-after': String(LISTING_RETRY_AFTER_SECONDS),
    'cache-control': 'no-store',
    'x-listing-lookup': 'unavailable',
  }
  if (reason) headers['x-listing-lookup-reason'] = reason.slice(0, 80).replace(/[^\x20-\x7e]/g, '')
  return new NextResponse(LISTING_UNAVAILABLE_HTML, { status: 503, headers })
}
