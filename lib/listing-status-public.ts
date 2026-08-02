/**
 * Public-surface listing status policy — THE single source of truth.
 *
 * COMPLIANCE RULE (absolute, non-negotiable):
 * "Coming Soon" listings MUST NEVER appear on any public-facing surface.
 * Coming Soon is an MLS pre-marketing state. Displaying it publicly — in a
 * search grid, a listing detail page, a sitemap, a count, a map pin, JSON-LD,
 * or an aggregate stat — is a licensing violation for Ryan Realty.
 *
 * Coming Soon IS permitted on:
 *   - /admin/** (broker-authenticated console)
 *   - internal cron / prospecting / compliance / sync tooling
 *   - broker-facing reports and CRM surfaces
 *
 * Before this module existed the status list was copy-pasted into ~20 files
 * across the DAL, the action layer, the sitemap, and SQL. That drift is how
 * Coming Soon reached the public site. Every public-facing status predicate
 * now imports from here. Enforced by scripts/check-public-listing-status.mjs
 * (npm run ci:public-listing-status), wired into ci:gates.
 *
 * If you are adding a public query: import PUBLIC_ACTIVE_STATUSES.
 * If you are adding an admin query: import ADMIN_ACTIVE_STATUSES and add the
 * file to the gate's ADMIN_ALLOWLIST with a reason.
 */

import type { ListingStatus } from '@/lib/data/types/listing'

/** The literal MLS StandardStatus string for pre-marketing listings. */
export const COMING_SOON_STATUS = 'Coming Soon' as const

/**
 * On-market statuses a PUBLIC visitor may see. Coming Soon is deliberately
 * absent — do not add it back.
 */
export const PUBLIC_ACTIVE_STATUSES: ListingStatus[] = ['Active', 'Active Under Contract']

/** Under-contract statuses a public visitor may see. */
export const PUBLIC_PENDING_STATUSES: ListingStatus[] = ['Pending']

/** Everything a public visitor may see on an on-market surface. */
export const PUBLIC_ON_MARKET_STATUSES: ListingStatus[] = [
  ...PUBLIC_ACTIVE_STATUSES,
  ...PUBLIC_PENDING_STATUSES,
]

/**
 * On-market statuses for ADMIN / broker surfaces. Includes Coming Soon because
 * brokers must see their own pre-marketing inventory.
 */
export const ADMIN_ACTIVE_STATUSES: ListingStatus[] = [
  'Active',
  COMING_SOON_STATUS,
  'Active Under Contract',
]

/**
 * True when the status is Coming Soon in any casing/spacing the feed sends
 * ("Coming Soon", "ComingSoon", "coming soon").
 */
export function isComingSoonStatus(s: string | null | undefined): boolean {
  return /coming\s*soon/i.test(String(s ?? ''))
}

/**
 * The public gate. False means the listing must not be rendered, linked,
 * counted, or indexed on a public surface.
 *
 * OPEN QUESTION (flagged 2026-07-21, deliberately NOT changed here): a null /
 * empty StandardStatus is currently treated as publicly displayable, because
 * every legacy predicate carried a `StandardStatus.is.null` branch and
 * isActiveStatus() returned true for empty. Tightening that in the same change
 * as the Coming Soon fix risked silently pulling live listings off the site, so
 * this function preserves the existing null behavior. Revisit separately.
 */
export function isPubliclyDisplayableStatus(s: string | null | undefined): boolean {
  return !isComingSoonStatus(s)
}

/**
 * The ONLY `statusFilter` values a public visitor may drive from the URL.
 *
 * Deliberately excludes 'coming_soon' (compliance) and the off-market values
 * 'expired' / 'withdrawn' / 'canceled' / 'off_market' / 'active_or_offmarket'
 * (broker prospecting vocabulary — never a public browse mode). The underlying
 * RPC still understands those; only authenticated admin callers may pass them.
 */
export const PUBLIC_SEARCH_STATUS_FILTERS: string[] = [
  'active',
  'active_and_pending',
  'pending',
  'closed',
  'all',
]

/**
 * PostgREST `.or()` predicate for public on-market reads against the raw
 * `listings` table (mixed-case column). Mirrors PUBLIC_ACTIVE_STATUSES.
 * Excludes the null-status and Coming Soon branches the old string carried.
 */
export const PUBLIC_ACTIVE_OR_PREDICATE =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%'

/**
 * Exact-match twin of PUBLIC_ACTIVE_OR_PREDICATE for queries against the raw
 * `listings` table that also filter by another unindexed column (e.g. "City").
 *
 * Measured 2026-08-02 while fixing /admin/media/banners (60s+ cold load):
 * combining `.eq('"City"', city)` with the ILIKE version above forces Postgres
 * into a per-row pattern-match scan and blows the anon role's 3s
 * statement_timeout for any city with more than a few thousand rows (Redmond
 * failed outright; Bend — 134K rows for that city alone — never would have
 * returned). The exact-match form lets Postgres use plain equality instead:
 * same city, same page, 176ms vs 2795ms+/timeout.
 *
 * Provably an equivalent superset for the isActiveStatus() && isPubliclyDisplayableStatus()
 * combination those callers post-filter with in JS (lib/listing-status.ts +
 * this file): that combined predicate is only ever true for status values
 * that are empty/null, exactly "active" (case-insensitive), or contain
 * "for sale" — the "contains coming soon" branch of isActiveStatus() is
 * always cancelled out by isPubliclyDisplayableStatus()'s negation, so Coming
 * Soon rows are correctly never needed here. Real StandardStatus values in
 * production are a clean RESO enum (Active, Closed, Expired, Canceled,
 * Withdrawn, Pending, Active Under Contract, Coming Soon, For Sale) with no
 * compound/hybrid strings, so "exactly For Sale" and "contains for sale"
 * coincide in practice. Use this ONLY as a coarse pre-filter to shrink what
 * gets fetched — callers must still apply the real isActiveStatus() /
 * isPubliclyDisplayableStatus() check in JS on the results; this predicate is
 * not itself the source of truth.
 */
export const PUBLIC_ACTIVE_OR_PREDICATE_EXACT =
  'StandardStatus.is.null,StandardStatus.eq.Active,StandardStatus.eq.For Sale'

/**
 * Public on-market (active + pending) `.or()` predicate for the raw table.
 */
export const PUBLIC_ON_MARKET_OR_PREDICATE =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%'

/** As above, plus the UnderContract/Contingent spellings the feed also sends. */
export const PUBLIC_ON_MARKET_OR_PREDICATE_WIDE =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Pending%,StandardStatus.ilike.%Under Contract%,StandardStatus.ilike.%UnderContract%,StandardStatus.ilike.%Contingent%'

/**
 * PostgREST `.or()` EXCLUSION predicate for lowercase-column MV reads
 * (listing_tile_mv_src and siblings). Mirrors the coming-soon-lockdown view
 * predicate (migration 20260721164833): NULL status passes (not pre-marketing),
 * any Coming Soon spelling is excluded. For service-client reads that bypass
 * the security_barrier view for index pushdown — keep in lockstep with the view.
 */
export const MV_NOT_COMING_SOON_OR_PREDICATE = `standard_status.is.null,standard_status.not.ilike.%${COMING_SOON_STATUS.replace(' ', '%')}%`
