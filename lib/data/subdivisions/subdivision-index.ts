/**
 * subdivision-index — the ONE definition of which subdivision plat pages are
 * indexable, plus the shared URL/line builders the sitemap AND llms.txt both
 * consume (W2.1/2.5 subdivision light-up, 2026-07-22).
 *
 * Pure module (no Supabase, no next/cache) so vitest can pin the threshold and
 * the sitemap-vs-llms parity without mocking infrastructure. The DAL wrapper
 * that feeds it live data is lib/data/subdivisions/getIndexableSubdivisions.ts.
 *
 * Indexability contract:
 *   a /subdivisions/[slug] page is INDEXABLE (robots index,follow + submitted
 *   in the sitemap + enumerated in llms.txt) when BOTH hold:
 *     1. the slug has an authoritative GIS polygon in public.boundaries
 *        (geo_type='subdivision' — Deschutes County plats, never approximated),
 *     2. at least SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime CLOSED sales
 *        sit INSIDE that polygon (point-in-polygon, subdivision_plat_closed_mv
 *        via getPlatClosedCounts.ts).
 *   Below the threshold the page still renders — it just carries noindex via
 *   pageMetadata({ noindex: true }) so thin plat pages never dilute the
 *   programmatic-page quality signal.
 *
 * WHY (2) IS A POLYGON JOIN AND NOT A NAME JOIN (SITE-24, 2026-09-08). Until
 * this change the two halves were measured on two different grains: the polygon
 * at RECORDED-PLAT grain, the sales by a text join on MLS "SubdivisionName" at
 * RESORT grain. Every home inside Ridge At Broken Top, Tennis Tracts At Broken
 * Top, Courtyard Garages At Broken Top and Golf Tracts At Broken Top is listed
 * under the single name "Broken Top"; every home in Golf Homes At Tetherow is
 * listed under "Tetherow". No sale is ever recorded under a sub-plat name, so
 * every sub-plat of a resort scored ZERO against any nonzero floor, forever,
 * however many houses sold inside it — 18 of the top 25 /subdivisions pages by
 * Search Console impressions were served noindex by that mismatch and Google
 * had started dropping them on recrawl. The threshold was never the variable.
 * The join was, and the floor below is unchanged at 10.
 *
 * NOTE this is deliberately stricter than the /homes-for-sale/{city}/{sub}
 * browse-pair floor (SUBDIVISION_SITEMAP_MIN_LIFETIME_LISTINGS = 3, all
 * statuses, app/sitemap.ts): a detail page earns its index slot with real
 * sold-history depth (the sales-history section), not just a listing trickle.
 */

import { slugify } from '@/lib/slug'

/**
 * Minimum lifetime CLOSED sales for a plat (that also has a GIS polygon) to be
 * indexable + sitemapped at /subdivisions/[slug]. Exported so the page, the
 * sitemap, llms.txt, and the tests all read the same number.
 */
export const SUBDIVISION_INDEX_MIN_LIFETIME_SALES = 10

/**
 * One plat's polygon-attributed lifetime closed sales — one row of
 * public.subdivision_plat_closed_mv, as the DAL hands it over
 * (getPlatClosedCounts.ts owns the query and its §0 trace).
 */
export type PlatClosedCount = {
  /** Recorded-plat slug — boundaries.geo_slug, geo_type='subdivision'. */
  slug: string
  /** Recorded-plat label — boundaries.geo_label, the county's own spelling. */
  label: string
  /**
   * Lifetime closed sales attributed to this plat, every property type. The
   * UNION over distinct listing_key of the two attributions below, so a sale
   * that is both inside the polygon and named for the plat counts once.
   */
  closedCount: number
  /** Of those, the ones whose point falls inside the recorded plat polygon. */
  closedInPolygon: number
  /** Of those, the ones recorded under this plat's own MLS SubdivisionName. */
  closedByName: number
  /** The PropertyType 'A' subset of closedCount. */
  closedCountSfr: number
  /** MLS city most of those sales were listed under. Display context only; null when unknown. */
  topCityLower: string | null
  /** Most recent close date among them, ISO. Null when the MV carries none. */
  lastCloseDate: string | null
  /**
   * The SAME sales, by calendar year of the close: `{ 2013: 4, 2014: 11, … }`.
   * The plat's own series, and on a sub-plat of a resort the only series there
   * is — the yearly table the page already prints is an MLS SubdivisionName
   * join and is empty for it.
   *
   * It comes off the same MV row as `closedCount`, so it is the same population
   * counted one level finer: the years sum to `closedCount` minus only the
   * sales carrying no close date. Empty when the MV holds no dated close.
   */
  closedByYear: Readonly<Record<number, number>>
}

export type IndexableSubdivision = {
  /** URL slug — boundaries.geo_slug for the recorded plat. */
  slug: string
  /** Display name — the recorded plat label the county assigned the polygon. */
  name: string
  /**
   * Slug of the MLS city most of the plat's closed sales were listed under
   * (display context for the title). Empty string when unknown — §0: the page
   * says nothing about the city rather than naming one that may not apply.
   */
  citySlug: string
  /** Lifetime closed sales inside the plat polygon. */
  closedCount: number
}

/**
 * Intersect the boundary-polygon slug set with the polygon-attributed closed
 * counts and apply the threshold. Deterministic + pure: same inputs, same
 * output, sorted by slug so sitemap/llms output is stable across regenerations.
 *
 * The boundary-slug argument is redundant by construction — subdivision_plat_closed_mv
 * is built BY joining boundaries, so every row already has a polygon — and it
 * is required anyway: it keeps the two-condition contract visible in one pure
 * function, and it is the guard that stops a plat surviving in a stale MV after
 * its polygon was withdrawn from `boundaries`.
 */
export function buildIndexableSubdivisions(
  boundarySlugs: ReadonlySet<string>,
  platCounts: readonly PlatClosedCount[],
  minLifetimeSales: number = SUBDIVISION_INDEX_MIN_LIFETIME_SALES,
): IndexableSubdivision[] {
  const out: IndexableSubdivision[] = []
  const seen = new Set<string>()

  for (const row of platCounts) {
    const slug = (row.slug ?? '').trim()
    if (!slug || slug === 'unknown' || slug === 'n-a') continue
    // Polygon requirement: no GIS plat boundary, no index slot.
    if (!boundarySlugs.has(slug)) continue
    if (row.closedCount < minLifetimeSales) continue
    // The MV's unique key is plat_slug, so a duplicate here means a corrupted
    // read; keep the first and never sum two rows into a doubled count.
    if (seen.has(slug)) continue
    seen.add(slug)
    const name = (row.label ?? '').trim() || slug
    // slugify() returns the literal 'unknown' for an empty or unslugglable
    // string, which would title the page "… | Unknown, Oregon". §0: an unknown
    // city is absent, never a place named Unknown.
    const rawCity = (row.topCityLower ?? '').trim()
    const citySlug = rawCity ? slugify(rawCity) : ''
    out.push({
      slug,
      name,
      citySlug: citySlug === 'unknown' ? '' : citySlug,
      closedCount: row.closedCount,
    })
  }

  out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  return out
}

/** Canonical detail path for a subdivision plat page. */
export function subdivisionDetailPath(slug: string): string {
  return `/subdivisions/${slug}`
}

/**
 * Sitemap URLs for the indexable set. app/sitemap.ts spreads these into its
 * dynamic pages; the parity test pins this against subdivisionLlmsLines so the
 * Google crawler map and the AI crawler map can never disagree.
 */
export function subdivisionSitemapUrls(
  subdivisions: readonly IndexableSubdivision[],
  baseUrl: string,
): string[] {
  const base = baseUrl.replace(/\/$/, '')
  return subdivisions.map((s) => `${base}${subdivisionDetailPath(s.slug)}`)
}

/** Title-case a city slug for display ("la-pine" -> "La Pine"). */
function cityLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * llms.txt lines for the indexable set — one "- Name (City): URL" per
 * subdivision, built from the SAME list the sitemap uses.
 */
export function subdivisionLlmsLines(
  subdivisions: readonly IndexableSubdivision[],
  siteUrl: string,
): string[] {
  const base = siteUrl.replace(/\/$/, '')
  return subdivisions.map((s) => {
    const url = `${base}${subdivisionDetailPath(s.slug)}`
    // No city, no parenthetical. "(  )" or "(Unknown)" would be a claim about
    // a place, and §0 forbids naming one the data did not give us.
    return s.citySlug ? `- ${s.name} (${cityLabel(s.citySlug)}): ${url}` : `- ${s.name}: ${url}`
  })
}
