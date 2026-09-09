import { NextResponse, type NextRequest } from 'next/server'
import { getListingDetail } from '@/lib/data'
import { listingCanonicalHref, listingsBrowsePath } from '@/lib/slug'

/**
 * Legacy AgentFire IDX listing-detail redirect (cutover SEO preservation).
 *
 * The old site exposed every listing at `/listing/odsmls/<mlsNumber>/<city>/
 * <street-address>/` (and variants with a status segment, e.g. `.../Sold/Bend/
 * <addr>`). Google indexed thousands of these and they 404 on the new site
 * after the ryan-realty.com cutover — the single biggest 404 pattern in GA4
 * (verified + live-probed 2026-06-02 via scripts/ga4-404-report.mjs).
 *
 * A Route Handler (not a page) so the redirect is an unambiguous HTTP 308 with
 * no React render. Pull the MLS number out of the path, resolve it
 * (getListingDetail matches ListNumber OR ListingKey), and 308 to the canonical
 * new URL. If the listing is gone (sold/off-market/unknown MLS#), fall back to
 * the search page so the visitor — and Googlebot — lands on a real 200 instead
 * of a dead end.
 */

// Resolved per request from the path + DB; never statically cached.
export const revalidate = 0

/** The MLS number is the first all-numeric path segment (6+ digits). */
function extractMlsNumber(slug: string[]): string | null {
  for (const seg of slug) {
    if (/^\d{6,}$/.test(seg ?? '')) return seg
  }
  for (const seg of slug) {
    const m = (seg ?? '').match(/\d{6,}/)
    if (m) return m[0]
  }
  return null
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> },
): Promise<NextResponse> {
  const { slug = [] } = await ctx.params
  const mls = extractMlsNumber(slug)

  let dest = listingsBrowsePath()
  if (mls) {
    const listing = await getListingDetail(mls).catch(() => null)
    if (listing) {
      // SITE-22: the same builder the canonical, the sitemap and every internal
      // href use. It was a hand-rolled copy that passed {city, subdivision} and
      // dropped the boundary fields, so this 308 landed on a URL the listing
      // does not canonicalise to — the redirect itself minted a duplicate.
      dest = listingCanonicalHref(listing)
    }
  }

  return NextResponse.redirect(new URL(dest, request.url), 308)
}
