/**
 * getRelatedListings — single public API for “keep exploring” inventory rails.
 *
 * Merges:
 *   1. Precomputed similar_listings_mv (same city, ±price/beds, same-subdivision first)
 *   2. Place-scoped price-proximity tiles (fetchNearbyTiles)
 *
 * Dedupes by listingKey, excludes the anchor, preserves similar-rank then
 * proximity. Callers pick a labeled rail; they do not re-derive ranking.
 */

import { getSimilarListings } from '@/lib/data/listings/getSimilarListings'
import { fetchNearbyTiles } from '@/lib/kb/fetch-nearby-tiles'
import type { ListingTile } from '@/lib/data/types/listing'

export type RelatedListingsScope = {
  subdivision?: string
  neighborhood?: string
  city?: string
}

export type RelatedListingsInput = {
  anchorKey: string
  excludeListNumber?: string | null
  subjectPrice?: number | null
  scope: RelatedListingsScope
  /** Max tiles returned after merge. */
  limit?: number
}

export type RelatedListingsResult = {
  /** Best overall set for a primary “homes near this place / like this” rail. */
  primary: ListingTile[]
  /** MV-only similar beds/price (may be empty for closed anchors). */
  similar: ListingTile[]
  /** Place-scoped price proximity (subdivision → city widen). */
  nearby: ListingTile[]
}

function mergeUnique(
  preferred: ListingTile[],
  secondary: ListingTile[],
  excludeKey: string,
  excludeListNumber: string | null | undefined,
  limit: number,
): ListingTile[] {
  const out: ListingTile[] = []
  const seen = new Set<string>([excludeKey])
  if (excludeListNumber) seen.add(`ln:${excludeListNumber}`)

  const push = (t: ListingTile) => {
    if (seen.has(t.listingKey)) return
    if (t.listNumber && seen.has(`ln:${t.listNumber}`)) return
    seen.add(t.listingKey)
    if (t.listNumber) seen.add(`ln:${t.listNumber}`)
    out.push(t)
  }

  for (const t of preferred) {
    push(t)
    if (out.length >= limit) return out
  }
  for (const t of secondary) {
    push(t)
    if (out.length >= limit) return out
  }
  return out
}

export async function getRelatedListings(
  input: RelatedListingsInput,
): Promise<RelatedListingsResult> {
  const limit = Math.min(Math.max(input.limit ?? 14, 1), 24)

  const [similar, nearby] = await Promise.all([
    getSimilarListings(input.anchorKey, Math.min(limit, 12)).catch(() => [] as ListingTile[]),
    fetchNearbyTiles(
      input.scope,
      input.anchorKey,
      input.excludeListNumber ?? null,
      input.subjectPrice,
    ).catch(() => [] as ListingTile[]),
  ])

  const primary = mergeUnique(
    similar,
    nearby,
    input.anchorKey,
    input.excludeListNumber,
    limit,
  )

  return { primary, similar, nearby }
}
