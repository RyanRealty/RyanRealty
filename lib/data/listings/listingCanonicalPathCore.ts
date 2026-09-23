/**
 * The pure half of the canonical-path lookup: which columns it reads, which
 * rows it refuses, and how a row becomes a path.
 *
 * Two readers share it and must agree row for row:
 *   - getListingCanonicalPathFields (Node, unstable_cache) behind
 *     /listing/by-key and /listing/odsmls;
 *   - getListingCanonicalPathFieldsEdge (Edge, no Next cache) behind the
 *     listing-canonical hop in middleware.ts.
 * No `next/cache`, no supabase-js, no Node API here: middleware bundles this.
 */

import { listingCanonicalHref } from '@/lib/slug'

/**
 * P14 (visibility audit 2026-09-22, gsc-trend-6): only MLS fields. The
 * polygon-derived boundary_city / boundary_neighborhood / boundary_subdivision
 * columns are not read, because the listing URL no longer depends on them
 * (lib/slug.ts listingTileHref). A column that cannot move the path has no
 * business on a hop that exists to find the path.
 */
export const LISTING_CANONICAL_PATH_COLUMNS = [
  'ListingKey',
  'ListNumber',
  'StreetNumber',
  'StreetName',
  'City',
  'State',
  'PostalCode',
  'SubdivisionName',
  // Display permissions. Not path fields — read only to REFUSE. See
  // mayDisplayListingPublicly below.
  'permit_internet_yn',
  'permit_address_internet_yn',
  'idx_participant',
] as const

export type ListingCanonicalPathFields = {
  ListingKey: string
  ListNumber: string | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
}

/**
 * IDX compliance (ODS Rule B/G, NAR 7.58) — the same gate getListingDetail
 * applies (2026-08-19). A hop that may not show the home may not publish its
 * address either, so a row that fails this is a MISS for every caller: the
 * by-key route renders the refusal, and the middleware hop passes the request
 * through to the page, which renders the same refusal.
 */
export function mayDisplayListingPublicly(row: Record<string, unknown>): boolean {
  return (
    row.permit_internet_yn !== false &&
    row.permit_address_internet_yn !== false &&
    row.idx_participant !== false
  )
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

export function mapListingCanonicalPathRow(row: Record<string, unknown>): ListingCanonicalPathFields | null {
  const listingKey = asNullableString(row.ListingKey)
  if (!listingKey) return null
  return {
    ListingKey: listingKey,
    ListNumber: asNullableString(row.ListNumber),
    StreetNumber: asNullableString(row.StreetNumber),
    StreetName: asNullableString(row.StreetName),
    City: asNullableString(row.City),
    State: asNullableString(row.State),
    PostalCode: asNullableString(row.PostalCode),
    SubdivisionName: asNullableString(row.SubdivisionName),
  }
}

/** The canonical path for a looked-up row: the ONE builder (SITE-22), nothing hand-rolled. */
export function listingCanonicalPathFromFields(row: ListingCanonicalPathFields): string {
  return listingCanonicalHref({
    listingKey: row.ListingKey,
    listNumber: row.ListNumber,
    streetNumber: row.StreetNumber,
    streetName: row.StreetName,
    city: row.City,
    subdivisionName: row.SubdivisionName,
  })
}
