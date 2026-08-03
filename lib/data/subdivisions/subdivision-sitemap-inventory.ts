/**
 * subdivision-sitemap-inventory: pure classification + aggregation for the
 * sitemap's (city, subdivision) browse-pair loop in app/sitemap.ts.
 *
 * WHY THIS EXISTS (2026-08-02 section 0 perf fix). The browse-pair loop used
 * to call get_subdivision_status_counts(p_city) per Central Oregon city. That
 * RPC filters `TRIM("City") ILIKE TRIM(p_city)` over the 589K-row `listings`
 * table, an unindexable expression that forced a sequential scan on every
 * call. Measured against production 2026-08-02: Bend 41,254ms, Sisters
 * 31,959ms, Redmond 14,644ms, La Pine 4,317ms, Madras 4,685ms, Terrebonne
 * 3,534ms, Sunriver 2,940ms, Prineville 1,410ms. 104.7s for eight cities
 * alone, before the rest of buildAllUrls even ran. That is the root cause of
 * the /sitemaps/*.xml 504s (maxDuration 300).
 *
 * The sitemap only needs to know WHICH subdivisions have enough inventory to
 * earn a browse-pair URL, not the active/pending/closed split the RPC
 * computes. listing_tile_mv already carries one row per listing (all
 * statuses, the MV has no standard_status filter, only the internet-display
 * exclusion described below) with an indexed `city_lower` column
 * (`listing_tile_mv_address_slug (city_lower, address_slug)` covers ALL
 * statuses, not just the active-ish partial indexes), so filtering by city is
 * an index scan instead of a per-row TRIM+ILIKE evaluation.
 *
 * classifyLifetimeBuckets() replicates get_subdivision_status_counts' exact
 * per-row classification (see supabase/migrations/20260802120000_..., the
 * live definition) so the SUM(active)+SUM(pending)+SUM(closed) "lifetime"
 * total computed here is byte-for-byte the same number the RPC would have
 * produced for any listing that is actually present in listing_tile_mv.
 *
 * ONE deliberate divergence, not a bug. listing_tile_mv is defined
 * `WHERE permit_internet_yn IS DISTINCT FROM false AND idx_participant IS
 * DISTINCT FROM false` (supabase/migrations/20260729193000_...). The RPC
 * scans raw `listings` and has no such filter. A subdivision whose only
 * listings are seller-opted-out-of-internet-display (or non-IDX-participant
 * broker) can therefore count toward the RPC's lifetime total but not this
 * one. Every listing DETAIL and BROWSE page already excludes those listings
 * (getPriceDropTiles.ts, getMotivatedListings.ts, getPropertyFactsByMls.ts
 * all `.not('permit_internet_yn', 'is', false)`), so a subdivision that only
 * cleared the RPC's threshold via non-displayable listings was already a
 * browse-pair URL whose page renders fewer live listings than the sitemap
 * threshold implied. This fix removes that class of over-counted URL rather
 * than introducing one. See the scratch verification script referenced from
 * the sitemap change for production counts of this delta.
 */

import { slugify } from '@/lib/slug'

/** Lifetime bucket a single listing status contributes to. Mirrors
 * get_subdivision_status_counts' three FILTER (WHERE ...) clauses exactly
 * (case-insensitive substring match, not exact-value match). A status can
 * contribute to more than one bucket only if its text matches more than one
 * clause, which the RPC also permits (independent FILTERs). Replicated here
 * rather than "fixed" so the two implementations agree byte-for-byte. */
export type LifetimeBucket = 'active' | 'pending' | 'closed'

export function classifyLifetimeBuckets(status: string | null | undefined): LifetimeBucket[] {
  const trimmed = (status ?? '').trim()
  const lower = trimmed.toLowerCase()
  const buckets: LifetimeBucket[] = []

  const isComingSoon = lower.includes('coming soon')
  const isPendingLike =
    lower.includes('pending') ||
    lower.includes('under contract') ||
    lower.includes('undercontract') ||
    lower.includes('contingent')

  const isActive =
    (trimmed === '' || lower.includes('active') || lower.includes('for sale')) &&
    !isComingSoon &&
    !isPendingLike

  if (isActive) buckets.push('active')
  if (isPendingLike) buckets.push('pending')
  if (lower.includes('closed')) buckets.push('closed')

  return buckets
}

/** One row read from listing_tile_mv for a single city (subdivision_name +
 * standard_status only, the sitemap needs nothing else). */
export type SubdivisionInventoryRow = {
  subdivision_name?: string | null
  standard_status?: string | null
}

/**
 * Aggregate a city's listing_tile_mv rows into the set of subdivision slugs
 * that meet the lifetime-listing floor, exactly mirroring the RPC-based loop
 * this replaces (dedup by slugify, drop empty/'N/A' names, drop the
 * 'unknown' slug).
 */
export function buildSubdivisionSlugsForCity(
  rows: readonly SubdivisionInventoryRow[],
  minLifetimeListings: number,
): string[] {
  const lifetimeBySlug = new Map<string, number>()
  const nameSeenForSlug = new Set<string>()

  for (const row of rows) {
    const name = (row.subdivision_name ?? '').trim()
    if (!name || name === 'N/A') continue
    const slug = slugify(name)
    if (slug === 'unknown') continue
    nameSeenForSlug.add(slug)
    const buckets = classifyLifetimeBuckets(row.standard_status)
    if (buckets.length === 0) continue
    lifetimeBySlug.set(slug, (lifetimeBySlug.get(slug) ?? 0) + buckets.length)
  }

  const out: string[] = []
  for (const slug of nameSeenForSlug) {
    if ((lifetimeBySlug.get(slug) ?? 0) >= minLifetimeListings) out.push(slug)
  }
  return out
}
