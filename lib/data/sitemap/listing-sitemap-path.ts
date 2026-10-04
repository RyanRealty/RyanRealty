/**
 * Pure listing-detail path for /sitemaps/listings.xml.
 *
 * Same helper the listing page canonical and every tile href use
 * (`listingTileHref` → `listingDetailPath`). Sitemap locs must agree with
 * that canonical. Do not invent a second path builder here.
 */
import { listingTileHref, listingsBrowsePath } from '@/lib/slug'
import { LISTING_MOSAIC_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'

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
  photo_url?: string | null
}

export type ListingSitemapRow = {
  listingKey: string
  path: string
  lastModified: string
  /** The lead photo at the size the listing page shows it, or null. */
  imageUrl: string | null
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
 * The listing's lead photo for an `<image:image>` entry: the same 1600x1200
 * Spark derivative the listing page's lead still loads, so the URL Google
 * finds in the sitemap is the URL it finds on the page. Null when the row has
 * no https photo or its media is suppressed. Display from the MLS's own CDN,
 * never a copy (ODS §3-13).
 */
export function listingSitemapImageUrl(row: ListingSitemapTile, suppressed: ReadonlySet<string>): string | null {
  const raw = String(row.photo_url ?? '').trim()
  if (!raw.startsWith('https://')) return null
  if (suppressed.has(String(row.listing_key ?? '').trim())) return null
  return listingRowPhotoSrc(raw, LISTING_MOSAIC_LEAD_PHOTO_SIZE)
}

/**
 * Deduplicate by listing_key (first wins) and drop rows that cannot build a
 * detail path. Stable input order is the caller's job — the DAL pages with
 * `.order('listing_key')`.
 */
export function assembleListingSitemapRows(
  rows: readonly ListingSitemapTile[],
  now: Date,
  mediaSuppressedKeys: ReadonlySet<string> = new Set(),
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
      imageUrl: listingSitemapImageUrl(row, mediaSuppressedKeys),
    })
  }
  return out
}
