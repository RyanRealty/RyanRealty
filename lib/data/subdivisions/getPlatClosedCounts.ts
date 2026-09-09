/**
 * getPlatClosedCounts — lifetime CLOSED sales per recorded county plat,
 * attributed by POINT-IN-POLYGON, from public.subdivision_plat_closed_mv
 * (migration 20260908160000_subdivision_plat_closed_mv.sql).
 *
 * WHY THIS EXISTS (SITE-24, 2026-09-08). Indexability at /subdivisions/<slug>
 * needs two things that were measured on two different grains:
 *
 *   the polygon  — public.boundaries, RECORDED-PLAT grain, 3.2K Deschutes
 *                  County plats;
 *   the sales    — a text join on MLS "SubdivisionName", RESORT grain.
 *
 * Every home inside Ridge At Broken Top, Tennis Tracts At Broken Top, Courtyard
 * Garages At Broken Top and Golf Tracts At Broken Top is listed under the one
 * name "Broken Top"; every home in Golf Homes At Tetherow is listed under
 * "Tetherow". Not one sale is ever recorded under a sub-plat name, so a
 * sub-plat scored zero against ANY nonzero floor, permanently, however many
 * houses actually sold inside it. The floor (10) was never the variable. The
 * join was.
 *
 * §0 VERIFICATION TRACE. One aggregate, computed once, server-side, inside the
 * MV — never in app code. Closed rows of public.listing_tile_mv
 * (`lower(standard_status) LIKE '%closed%'`) attributed to a plat of
 * public.boundaries (geo_type='subdivision', ST_IsValid) two ways —
 *
 *   A. ST_Contains(b.polygon,
 *        ST_SetSRID(ST_MakePoint(t.lng::float8, t.lat::float8), 4326))
 *   B. public.slugify_geo(t.subdivision_name) = b.geo_slug
 *
 * — then UNIONED over distinct listing_key and counted per plat, with
 * closed_in_polygon / closed_by_name carried beside the total.
 *
 * Window: lifetime — every closed sale listing_tile_mv holds, no date filter.
 * Population: every property type, which is what the text-join count it
 * replaces also measured (closedCountSfr carries the PropertyType 'A' subset
 * beside it for surfaces that publish an SFR figure).
 *
 * WHY THE UNION AND NOT A STRAIGHT REPLACEMENT. Measured on production, both
 * shapes: Tennis Tracts At Broken Top polygon 110 / name 0; Golf Homes At
 * Tetherow 107 / 0; Golf Tracts At Broken Top 54 / 0; Rock Ridge Cabin Sites
 * Of Black Butte Ranch 32 / 0; Outcrop 8 / 20+. Outcrop forbids a replacement:
 * its plat is real (0.0190 sq mi) and its sales ARE named "Outcrop", but six of
 * them share one builder geocode that falls outside the recorded polygon, so a
 * pure polygon join would have taken an INDEXED page's index slot away. Coarse
 * historical geocodes are not a one-plat special case. Geometry adds the sales
 * a name can never carry; the name keeps the sales a geocode lost.
 *
 * SAME SOURCE AS BEFORE, ON PURPOSE. listing_tile_mv is defined
 * `WHERE permit_internet_yn IS DISTINCT FROM false AND idx_participant IS
 * DISTINCT FROM false`, so an internet-display-opted-out or non-IDX listing
 * counts here no more than it counted under the text join — the divergence
 * documented in subdivision-sitemap-inventory.ts is carried forward unchanged,
 * not newly introduced. And the closed test is byte-identical to the
 * TypeScript classifier that path used (`lower.includes('closed')`).
 *
 * OVERLAP IS NOT DOUBLE COUNTING. A point can sit inside two recorded plats (a
 * replat over an original). Each plat reports that sale on its own row, which
 * is correct: the figure is "closed sales inside THIS plat", never a partition
 * of the county.
 *
 * THE SERIES RIDES ON THE SAME ROW. `closed_by_year` is the same union grouped
 * by calendar year of the close, so the plat's line and the plat's total are one
 * population and the years sum to the total minus only the sales carrying no
 * close date (measured 2026-09-09: for all six SITE-24 plats the years sum
 * EXACTLY to the total). It exists for the same reason the count does — the
 * yearly table the page already prints is the MLS-name join, and a sub-plat's is
 * empty, so this is the only series such a page can draw.
 *
 * WHAT THIS IS NOT. It is not a published market statistic and must not become
 * one: no median, no price, no YoY of a price. It is counts of sales inside a
 * boundary — the index gate's input, the figure the plat page prints under
 * platLifetimeClosedTrace(), and the series under it. A closed-PRICE statistic
 * at plat grain stays withheld (REGISTRY §4, publishSubdivisionClosedPrice).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import type { PlatClosedCount } from '@/lib/data/subdivisions/subdivision-index'

type PlatClosedRow = {
  plat_slug?: string | null
  plat_label?: string | null
  closed_count?: number | string | null
  closed_in_polygon?: number | string | null
  closed_by_name?: number | string | null
  closed_count_sfr?: number | string | null
  top_city_lower?: string | null
  last_close_date?: string | null
  closed_by_year?: Record<string, unknown> | null
}

function toCount(value: number | string | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

/**
 * The MV's `closed_by_year` jsonb, keyed by the calendar year as a number.
 *
 * DEFENSIVE ON PURPOSE, and not because the MV is untrusted: this map reaches a
 * CHART, and a chart is where a junk key becomes an axis. A year outside
 * 1900..(this year) or a non-positive count is dropped rather than plotted, so
 * a single bad close_date can never put a 1970 bar under a plat's series. An
 * absent or malformed object is an empty map — the page then draws nothing,
 * which is the §0 answer, never a flat line at zero.
 */
function toYearMap(value: Record<string, unknown> | null | undefined): Record<number, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const maxYear = new Date().getUTCFullYear()
  const out: Record<number, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    const year = Number(key)
    if (!Number.isInteger(year) || year < 1900 || year > maxYear) continue
    const count = toCount(raw as number | string | null | undefined)
    if (count > 0) out[year] = count
  }
  return out
}

async function fetchPlatClosedCounts(): Promise<PlatClosedCount[]> {
  // SERVICE client, not anon: this read runs beside getSubdivisionBoundarySlugs
  // (whose source table public.boundaries is RLS-hidden from anon — anon read =
  // 0 rows, service = 3.2K), and every consumer is server-only. The output is
  // non-sensitive: plat slugs and aggregate counts, no listing rows.
  const supabase = createServiceClient()

  // Stable order is mandatory for range paging (G48 / ci:row-cap, and the
  // 13.9%-duplicate incident documented in getIndexableSubdivisions.ts).
  // plat_slug is the MV's unique key, so it is a total order by itself.
  const { rows, error } = await fetchPagedRows<PlatClosedRow>((from, to) =>
    supabase
      .from('subdivision_plat_closed_mv')
      .select(
        'plat_slug,plat_label,closed_count,closed_in_polygon,closed_by_name,closed_count_sfr,top_city_lower,last_close_date,closed_by_year',
      )
      .order('plat_slug', { ascending: true })
      .range(from, to),
  )
  if (error) {
    // THROW, never return []: makeResilientCached must not cache a blip as
    // "no plat has any closed sales", which would noindex the whole class and
    // empty the sitemap section for the full 6h TTL.
    throw new Error(`getPlatClosedCounts: subdivision_plat_closed_mv read failed: ${error.message}`)
  }
  if (rows.length === 0) {
    // The MV holds a row for every plat with at least one closed sale inside
    // it. Production has thousands; zero is a failed or unpopulated read, not
    // a county with no sales.
    throw new Error('getPlatClosedCounts: subdivision_plat_closed_mv returned 0 rows')
  }

  return rows
    .map((row) => {
      const slug = (row.plat_slug ?? '').trim()
      if (!slug) return null
      return {
        slug,
        label: (row.plat_label ?? '').trim() || slug,
        closedCount: toCount(row.closed_count),
        closedInPolygon: toCount(row.closed_in_polygon),
        closedByName: toCount(row.closed_by_name),
        closedCountSfr: toCount(row.closed_count_sfr),
        topCityLower: (row.top_city_lower ?? '').trim() || null,
        lastCloseDate: row.last_close_date ?? null,
        closedByYear: toYearMap(row.closed_by_year),
      }
    })
    .filter((r): r is PlatClosedCount => r !== null)
}

/**
 * Cached 6h (CACHE_WINDOWS.marketStats) — the MV itself only moves when a sale
 * closes, and the sitemap regenerates hourly, so 6h staleness is invisible.
 * Tagged `boundaries` so the same revalidate that busts the polygon set busts
 * this.
 */
export const getPlatClosedCounts = makeResilientCached(
  fetchPlatClosedCounts,
  // KEY IS v2-years, NOT v1. The row shape gained closed_by_year; a deploy that
  // kept the key would serve mapped rows with no series out of a warm cache for
  // six more hours and the plat market band would still say it cannot chart.
  ['plat-closed-counts-v2-years'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'boundaries'],
  },
  [],
)

/**
 * One plat's polygon-attributed closed count, off the same cached set — so a
 * page that already read the index set pays for no second query. Returns null
 * when the plat has no row (no closed sale has ever fallen inside its polygon),
 * which the caller must render as "not published", never as zero: §0, unknown
 * is not zero.
 */
export async function getPlatClosedCount(slug: string): Promise<PlatClosedCount | null> {
  const trimmed = slug.trim().toLowerCase()
  if (!trimmed) return null
  const all = await getPlatClosedCounts()
  return all.find((r) => r.slug === trimmed) ?? null
}
