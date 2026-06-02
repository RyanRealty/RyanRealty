import { NextResponse, type NextRequest } from 'next/server'
import { getListingDetail } from '@/lib/data'
import { listingDetailPath, listingsBrowsePath } from '@/lib/slug'

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
      // Match the sitemap's canonical builder: a literal "N/A" subdivision would
      // slugify into a bogus /na/ segment, so drop it (keeps this redirect's
      // target identical to the indexed canonical URL — no canonical/sitemap split).
      const subdivision =
        listing.subdivisionName && listing.subdivisionName !== 'N/A' ? listing.subdivisionName : null
      dest = listingDetailPath(
        listing.listingKey,
        {
          streetNumber: listing.streetNumber,
          streetName: listing.streetName,
          city: listing.city,
          state: null,
          postalCode: listing.postalCode,
        },
        { city: listing.city, subdivision },
        { mlsNumber: listing.listNumber },
      )
    }
  }

  return NextResponse.redirect(new URL(dest, request.url), 308)
}
