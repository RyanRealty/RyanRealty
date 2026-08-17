/**
 * Related homes on a place-about blog post.
 *
 * The post names a buyable place (matchBlogPlace). The homes are the same
 * listing_tile_mv Active + PropertyType A set the city/community page uses.
 * Withhold when the fetch is empty. Cap the teaser. Do not invent a listing.
 */
import { formatPrice } from '@/lib/format/money'
import { listingTileHref } from '@/lib/slug'
import type { BlogPlace } from './match-blog-place'

export const BLOG_RELATED_HOMES_LIMIT = 6

export type BlogHomeTile = {
  listingKey: string
  listNumber?: string | null
  listPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  streetNumber: string | null
  streetName: string | null
  streetSuffix?: string | null
  city: string | null
  subdivisionName: string | null
  photoUrl: string | null
  lat: number | null
  lng: number | null
  boundaryCity?: string | null
  boundaryNeighborhood?: string | null
}

export type PublishedBlogHome = {
  id: string
  href: string
  priceLabel: string
  title: string
  meta?: string
  photoSrc?: string
  lat?: number | null
  lng?: number | null
}

export type PublishedBlogRelatedHomes = {
  place: BlogPlace
  items: PublishedBlogHome[]
  source: string
}

function sourceLine(place: BlogPlace): string {
  const fn = place.kind === 'community' ? 'getCommunityListings' : 'getCityListings'
  return `listing_tile_mv via ${fn}, PropertyType A, Active, ${place.label}`
}

export function publishBlogRelatedHomes(
  place: BlogPlace,
  tiles: readonly BlogHomeTile[],
): PublishedBlogRelatedHomes | null {
  const seen = new Set<string>()
  const items: PublishedBlogHome[] = []
  for (const tile of tiles) {
    const key = tile.listingKey?.trim()
    const photo = tile.photoUrl?.trim()
    if (!key || !photo || seen.has(key)) continue
    seen.add(key)
    const street = [tile.streetNumber, tile.streetName, tile.streetSuffix].filter(Boolean).join(' ').trim()
    const meta = [
      tile.beds != null ? `${tile.beds} bd` : null,
      tile.baths != null ? `${tile.baths} ba` : null,
      tile.sqft != null && tile.sqft > 0 ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    items.push({
      id: key,
      href: listingTileHref(tile),
      priceLabel: tile.listPrice != null && tile.listPrice > 0 ? formatPrice(tile.listPrice) : 'Price on request',
      title: street || tile.subdivisionName?.trim() || 'Address withheld',
      meta: meta || undefined,
      photoSrc: photo,
      lat: tile.lat,
      lng: tile.lng,
    })
    if (items.length >= BLOG_RELATED_HOMES_LIMIT) break
  }
  if (items.length === 0) return null
  return { place, items, source: sourceLine(place) }
}
