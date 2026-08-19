/**
 * Pure listing-detail path for /sitemaps/listings.xml.
 *
 * Same helper the listing page canonical and every tile href use
 * (`listingTileHref` → `listingDetailPath`). Sitemap locs must agree with
 * that canonical. Do not invent a second path builder here.
 */
import { listingTileHref, listingsBrowsePath } from '@/lib/slug'

export type ListingSitemapTile = {
  listing_key: string
  list_number?: string | null
  street_number?: string | null
  street_name?: string | null
  city?: string | null
  subdivision_name?: string | null
  boundary_city?: string | null
  boundary_neighborhood?: string | null
  modified_at?: string | null
}

export type ListingSitemapRow = {
  listingKey: string
  path: string
  lastModified: string
}

/** Canonical listing path, or null when the row cannot produce a detail URL. */
export function listingSitemapPath(row: ListingSitemapTile): string | null {
  const listingKey = String(row.listing_key ?? '').trim()
  if (!listingKey) return null
  const path = listingTileHref({
    listingKey,
    listNumber: row.list_number ?? null,
    streetNumber: row.street_number ?? null,
    streetName: row.street_name ?? null,
    city: row.city ?? null,
    boundaryCity: row.boundary_city ?? null,
    boundaryNeighborhood: row.boundary_neighborhood ?? null,
    subdivisionName: row.subdivision_name ?? null,
  })
  if (!path || path === listingsBrowsePath()) return null
  return path
}

/**
 * Deduplicate by listing_key (first wins) and drop rows that cannot build a
 * detail path. Stable input order is the caller's job — the DAL pages with
 * `.order('listing_key')`.
 */
export function assembleListingSitemapRows(
  rows: readonly ListingSitemapTile[],
  now: Date,
): ListingSitemapRow[] {
  const seen = new Set<string>()
  const out: ListingSitemapRow[] = []
  for (const row of rows) {
    const listingKey = String(row.listing_key ?? '').trim()
    if (!listingKey || seen.has(listingKey)) continue
    const path = listingSitemapPath(row)
    if (!path) continue
    seen.add(listingKey)
    const lastModified = row.modified_at ? new Date(row.modified_at) : now
    out.push({
      listingKey,
      path,
      lastModified: Number.isNaN(lastModified.getTime()) ? now.toISOString() : lastModified.toISOString(),
    })
  }
  return out
}
