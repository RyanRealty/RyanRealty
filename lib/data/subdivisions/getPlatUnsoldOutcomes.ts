/**
 * getPlatUnsoldOutcomes — the twelve-month DID-NOT-SELL aggregate for one
 * recorded county plat, from public.subdivision_plat_unsold_mv (migration
 * 20260909200000_subdivision_plat_unsold_mv.sql).
 *
 * WHY THIS EXISTS (SITE-55, 2026-09-09). Matt, on the expired-listing first
 * message: "show that we are true market experts by being able to dive into
 * that subdivision they're in… it has to be dialed so we can show them exactly
 * what's going on there, including homes that sold and didn't sell." The sold
 * half is getPlatClosedCounts. This is the other half, and outside the seller
 * CMA — which reads raw listings per CITY — it existed nowhere.
 *
 * AGGREGATE ONLY. Oregon MLS policy (docs/MASTER_SPEC.md §3.8): Withdrawn,
 * Expired and Cancelled listings "may not be actively marketed" and "must not
 * appear in search results or active listing feeds." A per-plat count with a
 * median days-listed and a median cut is market reporting, the same class of
 * figure as months of supply. A public list of failed ADDRESSES would be a
 * display surface for off-market listings; that is Matt's ruling to make, and
 * it is recorded on the node rather than shipped. The MV carries no
 * listing_key, no address and no price out of the aggregate, so no caller can
 * publish one by accident.
 *
 * §0 VERIFICATION TRACE. One aggregate, computed server-side inside the MV,
 * never in app code. Rows of public.listings with
 *   "StandardStatus" in ('Expired','Canceled','Cancelled','Withdrawn')
 *   and off_market_date within the rolling twelve months
 *   and permit_internet_yn is distinct from false
 *   and idx_participant is distinct from false
 * attributed to a plat of public.boundaries (geo_type='subdivision', ST_IsValid)
 * two ways — ST_Contains(polygon, point) and slugify_geo("SubdivisionName") =
 * geo_slug — unioned over distinct "ListingKey" so a listing counts once per
 * plat however it matched. Measured on production at first refresh: 1,164 plats
 * carry at least one, 2,995 listings in total, 2,703 by polygon and 292 by
 * name, window 2025-09-09..2026-09-09.
 *
 * COVERAGE. The view carries a row for every plat it measures, so `null` from
 * this read means the plat is outside the measured set and a caller must say
 * nothing rather than claim a clean record; `unsoldCount: 0` is the clean
 * record, measured.
 *
 * DAYS IT RAN is off_market_date - listing_contract_date, the same list-to-off
 * span the CMA calls the final cycle, never "DaysOnMarket" (list-to-close;
 * docs/DATABASE_FOR_AI_AGENTS.md §4a). A row with no contract date joins the
 * count and not the median — `daysSample` is what the median was taken over,
 * and a caller that prints the median prints that n.
 *
 * THE CUT is total_price_change_pct where it is negative. A plat where nothing
 * cut reports cutCount 0 and a null median: unknown is not zero.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

export type PlatUnsoldOutcome = {
  platSlug: string
  platLabel: string | null
  /** Listings that came off the market without selling in the window. */
  unsoldCount: number
  /** How the count was attributed, carried so no surface conflates the two. */
  unsoldInPolygon: number
  unsoldByName: number
  /** Median days from listing contract to off-market, over `daysSample` rows. */
  medianDaysListed: number | null
  daysSample: number
  /** How many of them cut the ask before coming off, and by how much (median). */
  cutCount: number
  medianCutPct: number | null
  /** The window the MV measured, stamped at refresh. */
  windowStart: string | null
  windowEnd: string | null
}

type UnsoldRow = {
  geo_slug?: string | null
  geo_label?: string | null
  unsold_count?: number | string | null
  unsold_in_polygon?: number | string | null
  unsold_by_name?: number | string | null
  median_days_listed?: number | string | null
  days_sample?: number | string | null
  cut_count?: number | string | null
  median_cut_pct?: number | string | null
  window_start?: string | null
  window_end?: string | null
}

function toCount(value: number | string | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

function toRate(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function mapPlatUnsoldRow(row: UnsoldRow): PlatUnsoldOutcome | null {
  const slug = row.geo_slug?.trim().toLowerCase()
  if (!slug) return null
  // A ZERO ROW IS A MEASUREMENT, NOT AN ABSENCE. The MV emits a row for every
  // plat it can speak for — every recorded plat plus every MLS subdivision name
  // that has carried a listing — so unsoldCount 0 means "measured, nothing
  // failed" and a MISSING row means "this view does not cover that plat". The
  // first shape of this read collapsed the two and published "Every home that
  // came off the market in Diamond Bar Ranch sold" while two had come off
  // unsold inside the window; that plat simply had no boundaries row for the
  // join to reach (CLAUDE.md §0, absence from one query shape).
  const unsoldCount = toCount(row.unsold_count)
  const daysSample = toCount(row.days_sample)
  return {
    platSlug: slug,
    platLabel: row.geo_label?.trim() || null,
    unsoldCount,
    unsoldInPolygon: toCount(row.unsold_in_polygon),
    unsoldByName: toCount(row.unsold_by_name),
    // A median with no sample behind it is not a median.
    medianDaysListed: daysSample > 0 ? toRate(row.median_days_listed) : null,
    daysSample,
    cutCount: toCount(row.cut_count),
    medianCutPct: toCount(row.cut_count) > 0 ? toRate(row.median_cut_pct) : null,
    windowStart: row.window_start?.trim() || null,
    windowEnd: row.window_end?.trim() || null,
  }
}

async function fetchPlatUnsoldOutcome(slug: string): Promise<PlatUnsoldOutcome | null> {
  const trimmed = slug.trim().toLowerCase()
  if (!trimmed) return null
  const supabase = supabaseAnon()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('subdivision_plat_unsold_mv')
    .select(
      'geo_slug, geo_label, unsold_count, unsold_in_polygon, unsold_by_name, median_days_listed, days_sample, cut_count, median_cut_pct, window_start, window_end',
    )
    .eq('geo_slug', trimmed)
    .maybeSingle()

  if (error) {
    // THROW, never return null: makeResilientCached must not cache a blip as
    // "this plat had no failed listings", which is a claim about the market.
    throw new Error(`subdivision_plat_unsold_mv read failed for "${trimmed}": ${error.message}`)
  }
  return data ? mapPlatUnsoldRow(data as UnsoldRow) : null
}

/**
 * Cached 6h beside its closed sibling. The window is rolling, so the figure
 * moves when the nightly refresh moves it, not when the cache expires — which
 * is why every caller prints windowEnd rather than "today".
 */
export const getPlatUnsoldOutcome = makeResilientCached(
  fetchPlatUnsoldOutcome,
  // KEY IS v2-covered, NOT v1. Under v1 the MV emitted a row only where
  // something failed, so a clean plat cached as `null` — and null now means
  // "not measured", which reads as silence rather than as a clean record. A
  // deploy that kept the key would serve those nulls for six more hours and
  // every clean plat would go quiet. Same reason the closed sibling is on
  // 'plat-closed-counts-v2-years'.
  ['plat-unsold-outcome-v2-covered'],
  { revalidate: CACHE_WINDOWS.marketStats, tags: [cacheTag.market, 'boundaries'] },
  null,
)
