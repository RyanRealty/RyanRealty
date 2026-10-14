/**
 * Listing-page robots + canonical (2026-10-13, extended).
 *
 * Off-market detail URLs (Closed, Expired, Canceled, Withdrawn) were keeping
 * index, follow under the 2026-09-08 SITE-32 ruling. Search Console then
 * showed community pages — Brasada Ranch first — losing impressions to
 * listing URLs, including homes already off the market. That ruling is
 * superseded.
 *
 *   - On market (Active, Active Under Contract, Pending) → index, follow,
 *     self-canonical. Pending is still marketable.
 *   - Off market and off the market for 90 days or less → index, follow,
 *     self-canonical. Address queries still have a live page while the
 *     sale or withdrawal is recent.
 *   - Off market and older than 90 days (or with no dated close / modify)
 *     → noindex, follow. Canonical is the registry community page when
 *     one exists, otherwise the city hub, otherwise the listing itself.
 *
 * Geography is not an input for on-market homes (SITE-33 reverted
 * 2026-10-05). listings.xml submits LISTING_SITEMAP_STATUSES only.
 * Held by ci:listing-offmarket-index.
 */

import { isPublicOffMarketStatus } from '@/lib/listing-status-public'

/** Closed / Expired / Withdrawn / Canceled pages older than this leave the index. */
export const OFF_MARKET_NOINDEX_AFTER_DAYS = 90

const OFF_MARKET_NOINDEX_AFTER_MS = OFF_MARKET_NOINDEX_AFTER_DAYS * 24 * 60 * 60 * 1000

export type ListingIndexPolicyInput = {
  status: string | null | undefined
  listingPath: string
  communityHref?: string | null
  cityHref?: string | null
  /** CloseDate when present; ModificationTimestamp otherwise. */
  offMarketAt?: string | Date | null
  now?: Date
}

export type ListingIndexPolicy = {
  noindex: boolean
  canonicalPath: string
}

function cleanPath(path: string | null | undefined): string | null {
  const trimmed = (path ?? '').trim()
  if (!trimmed) return null
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** Age of the off-market event, or null when the date cannot be read. */
export function listingOffMarketAgeMs(
  offMarketAt: string | Date | null | undefined,
  now: Date,
): number | null {
  if (offMarketAt == null || offMarketAt === '') return null
  const t = offMarketAt instanceof Date ? offMarketAt.getTime() : Date.parse(String(offMarketAt))
  if (!Number.isFinite(t)) return null
  return now.getTime() - t
}

/**
 * True when the home has been off market longer than 90 days, or when we
 * cannot prove it is recent. An unknown date is treated as stale so a
 * Closed home without CloseDate cannot stay in the index forever.
 */
export function listingIsStaleOffMarket(
  offMarketAt: string | Date | null | undefined,
  now: Date,
): boolean {
  const age = listingOffMarketAgeMs(offMarketAt, now)
  if (age == null) return true
  return age > OFF_MARKET_NOINDEX_AFTER_MS
}

/** CloseDate first, then ModificationTimestamp. Neither is invented. */
export function listingOffMarketAnchor(input: {
  closeDate?: string | Date | null
  modifiedAt?: string | Date | null
}): string | Date | null {
  const close = input.closeDate ?? null
  if (close != null && String(close).trim() !== '') return close
  const modified = input.modifiedAt ?? null
  if (modified != null && String(modified).trim() !== '') return modified
  return null
}

export function listingHubCanonicalPath(input: {
  listingPath: string
  communityHref?: string | null
  cityHref?: string | null
}): string {
  return cleanPath(input.communityHref) ?? cleanPath(input.cityHref) ?? input.listingPath
}

export function listingIndexPolicy(input: ListingIndexPolicyInput): ListingIndexPolicy {
  const listingPath = cleanPath(input.listingPath) ?? '/'
  if (!isPublicOffMarketStatus(input.status)) {
    return { noindex: false, canonicalPath: listingPath }
  }
  const now = input.now ?? new Date()
  if (!listingIsStaleOffMarket(input.offMarketAt, now)) {
    return { noindex: false, canonicalPath: listingPath }
  }
  return {
    noindex: true,
    canonicalPath: listingHubCanonicalPath({
      listingPath,
      communityHref: input.communityHref,
      cityHref: input.cityHref,
    }),
  }
}
