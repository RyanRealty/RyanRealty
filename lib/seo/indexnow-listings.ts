/**
 * Which listing pages the MLS delta sync tells IndexNow about, and at which
 * URL (lib/seo/indexnow.ts; called from lib/sync/deltaSync.ts after the write).
 *
 * The URL is the listing canonical, built by the same pure core the canonical
 * hop uses (mapListingCanonicalPathRow + listingCanonicalPathFromFields, i.e.
 * listingCanonicalHref, the one builder the listing page, its JSON-LD and
 * /sitemaps/listings.xml all use). Never a hand-built path.
 *
 * A written row is skipped when the site does not put its page in the index,
 * by the same rules the page itself applies:
 *   - IDX opt-outs: permit_internet_yn, permit_address_internet_yn or
 *     idx_participant false (mayDisplayListingPublicly, the gate
 *     getListingDetail and the canonical hop share) → the page is a 404;
 *   - Coming Soon (MLS pre-marketing) → never renders on a public surface;
 *   - off market for more than 90 days, or with no dated close or change
 *     (listingIndexPolicy) → noindex, so there is nothing for an engine to add.
 * Recent Closed, Expired, Withdrawn and Canceled pages DO count: they stay
 * indexed and their state just changed (MASTER_SPEC §4.9).
 *
 * Media suppression does not hide the page, only its photos, so it is not a
 * skip here. computeDeltaPlan does not count a photo change on a
 * media-suppressed listing, because its page shows no photo either way.
 */

import {
  listingCanonicalPathFromFields,
  mapListingCanonicalPathRow,
  mayDisplayListingPublicly,
} from '@/lib/data/listings/listingCanonicalPathCore'
import { isComingSoonStatus } from '@/lib/listing-status-public'
import { listingIndexPolicy, listingOffMarketAnchor } from '@/lib/listing/listing-index-policy'
import { indexNowUrl } from '@/lib/seo/indexnow'
import { listingsBrowsePath } from '@/lib/slug'

/** Why a listing's public page changed in a sync run. */
export type ListingPageChange = 'new' | 'status' | 'price' | 'photo' | 'reopened'

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * The canonical path of a written listings row (Spark-mapped field names),
 * or null when the page is not one the site shows in the index.
 */
export function listingIndexNowPath(row: Record<string, unknown>, now: Date): string | null {
  const fields = mapListingCanonicalPathRow(row)
  if (!fields) return null
  if (!mayDisplayListingPublicly(row)) return null
  const status = str(row.StandardStatus)
  if (isComingSoonStatus(status)) return null
  const path = listingCanonicalPathFromFields(fields)
  if (!path || path === listingsBrowsePath()) return null
  const policy = listingIndexPolicy({
    status,
    listingPath: path,
    offMarketAt: listingOffMarketAnchor({ closeDate: str(row.CloseDate), modifiedAt: str(row.ModificationTimestamp) }),
    now,
  })
  return policy.noindex ? null : path
}

/** Absolute canonical URLs for the written rows whose pages are indexable, deduplicated. */
export function listingIndexNowUrls(rows: Iterable<Record<string, unknown>>, now: Date): string[] {
  const out = new Set<string>()
  for (const row of rows) {
    const path = listingIndexNowPath(row, now)
    if (path) out.add(indexNowUrl(path))
  }
  return [...out]
}
