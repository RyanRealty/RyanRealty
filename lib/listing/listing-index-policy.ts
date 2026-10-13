/**
 * Listing-page robots + canonical (2026-10-13).
 *
 * Off-market detail URLs (Closed, Expired, Canceled, Withdrawn) were keeping
 * index, follow under the 2026-09-08 SITE-32 ruling. Search Console then
 * showed community pages — Brasada Ranch first — losing impressions to
 * listing URLs, including homes already off the market. That ruling is
 * superseded: those pages stay up (SITE-21 honest state, HTTP 200) but they
 * leave the index.
 *
 *   - Off market + a registry community page → noindex, follow, canonical
 *     to that community URL so Google consolidates to the place page.
 *   - Off market + no community page → noindex, follow, self-canonical.
 *   - On market (Active, Active Under Contract, Pending) → index, follow,
 *     self-canonical. Pending is still marketable.
 *
 * Geography is not an input (SITE-33 reverted 2026-10-05). listings.xml
 * still submits Active/AUC only. Held by ci:listing-offmarket-index.
 */

import { isPublicOffMarketStatus } from '@/lib/listing-status-public'

export type ListingIndexPolicyInput = {
  status: string | null | undefined
  listingPath: string
  communityHref?: string | null
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

export function listingIndexPolicy(input: ListingIndexPolicyInput): ListingIndexPolicy {
  const listingPath = cleanPath(input.listingPath) ?? '/'
  const communityHref = cleanPath(input.communityHref)
  if (!isPublicOffMarketStatus(input.status)) {
    return { noindex: false, canonicalPath: listingPath }
  }
  return {
    noindex: true,
    canonicalPath: communityHref ?? listingPath,
  }
}
