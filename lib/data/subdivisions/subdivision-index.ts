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
 *     2. the subdivision has >= SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime
 *        CLOSED sales (summed across Central Oregon cities from the
 *        get_subdivision_status_counts RPC — the same server-side aggregate the
 *        sitemap's browse-pair loop uses).
 *   Below the threshold the page still renders — it just carries noindex via
 *   pageMetadata({ noindex: true }) so thin plat pages never dilute the
 *   programmatic-page quality signal.
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

/** One row of the get_subdivision_status_counts RPC result (per city). */
export type SubdivisionStatusCountRow = {
  subdivision_name?: string | null
  active?: number | null
  pending?: number | null
  closed?: number | null
}

/** Per-city RPC result bundle, as fetched by the DAL. */
export type CitySubdivisionCounts = {
  citySlug: string
  rows: SubdivisionStatusCountRow[]
}

export type IndexableSubdivision = {
  /** URL slug — slugify(MLS SubdivisionName), matches boundaries.geo_slug. */
  slug: string
  /** Display name — the trimmed MLS SubdivisionName that produced the slug. */
  name: string
  /** Slug of the city contributing the most closed sales (display context). */
  citySlug: string
  /** Lifetime closed-sale count summed across all Central Oregon cities. */
  closedCount: number
}

/**
 * Intersect the boundary-polygon slug set with the per-city closed-sale counts
 * and apply the threshold. Deterministic + pure: same inputs, same output,
 * sorted by slug so sitemap/llms output is stable across regenerations.
 */
export function buildIndexableSubdivisions(
  boundarySlugs: ReadonlySet<string>,
  cityCounts: readonly CitySubdivisionCounts[],
  minLifetimeSales: number = SUBDIVISION_INDEX_MIN_LIFETIME_SALES,
): IndexableSubdivision[] {
  // slug -> accumulated closed count + best (name, city) by per-city closed.
  const acc = new Map<
    string,
    { name: string; citySlug: string; closedCount: number; bestCityClosed: number }
  >()

  for (const { citySlug, rows } of cityCounts) {
    for (const row of rows) {
      const name = (row.subdivision_name ?? '').trim()
      // 'N/A' would slugify into a bogus /n-a/ segment — same guard as the
      // sitemap browse-pair loop.
      if (!name || name === 'N/A') continue
      const slug = slugify(name)
      if (slug === 'unknown') continue
      // Polygon requirement: no GIS plat boundary, no index slot.
      if (!boundarySlugs.has(slug)) continue
      const closed = row.closed ?? 0
      const existing = acc.get(slug)
      if (existing) {
        existing.closedCount += closed
        if (closed > existing.bestCityClosed) {
          existing.bestCityClosed = closed
          existing.citySlug = citySlug
          existing.name = name
        }
      } else {
        acc.set(slug, { name, citySlug, closedCount: closed, bestCityClosed: closed })
      }
    }
  }

  const out: IndexableSubdivision[] = []
  for (const [slug, v] of acc) {
    if (v.closedCount < minLifetimeSales) continue
    out.push({ slug, name: v.name, citySlug: v.citySlug, closedCount: v.closedCount })
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
  return subdivisions.map(
    (s) => `- ${s.name} (${cityLabel(s.citySlug)}): ${base}${subdivisionDetailPath(s.slug)}`,
  )
}
