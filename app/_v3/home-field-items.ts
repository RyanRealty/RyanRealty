/**
 * Tile -> V3FieldItem for the homepage inventory Field.
 *
 * Same honesty as app/cities/[slug]/_v3/city-field-items.ts: a tile earns a row
 * when it carries a price, an address, and a live MLS photograph (the curated
 * homepage set is photography-first, so dropping a photoless tile never
 * invents a door). The ask goes through formatPublishedAsk and
 * a fractional ask never prints unlabeled: publishListingShareKind rides the
 * meta line (the Camp Sherman quarter-share rule). The meta line also names the
 * town, because this list spans the whole region.
 */

import type { V3FieldItem } from '@/components/site/v3'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { listingDetailPath } from '@/lib/slug'
import {
  classifyHomeFieldType,
  takeHomeFieldByType,
  type HomeFieldCat,
  type HomeFieldTypeKey,
} from './home-field-types'

export type HomeFieldItem = V3FieldItem & {
  /** MLS city, used by homepage town chips to filter the listed set. */
  city: string
  typeKey: HomeFieldTypeKey
  typeLabel: string
  cat?: HomeFieldCat
}

export function filterHomeFieldByCity(
  items: readonly HomeFieldItem[],
  city: string | null,
): HomeFieldItem[] {
  if (!city) return [...items]
  const needle = city.trim().toLowerCase()
  if (!needle) return [...items]
  return items.filter((item) => item.city.trim().toLowerCase() === needle)
}

export function homeFieldItems(tiles: readonly ListingTile[], limit: number): HomeFieldItem[] {
  const items: HomeFieldItem[] = []

  for (const tile of tiles) {
    if (items.length >= limit) break
    if (tile.listPrice == null || !Number.isFinite(tile.listPrice) || tile.listPrice <= 0) continue

    const street = publishStreetLine({
      streetNumber: tile.streetNumber,
      streetName: tile.streetName,
      streetSuffix: tile.streetSuffix,
    })
    if (!street) continue
    if (!tile.photoUrl || tile.photoUrl.trim().length === 0) continue

    const shareKind = publishListingShareKind({
      propertySubType: tile.propertySubType,
      subdivisionName: tile.subdivisionName,
      city: tile.city,
      listNumber: tile.listNumber,
    })
    // City moved from meta to the title (Matt 2026-08-27: a card address
    // names its city) — publishCardAddress below carries it.
    const meta = [
      tile.beds != null ? `${tile.beds} bd` : null,
      tile.baths != null ? `${tile.baths} ba` : null,
      tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
      shareKind,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ')

    const type = classifyHomeFieldType({
      propertyType: tile.propertyType,
      propertySubType: tile.propertySubType,
    })

    items.push({
      id: tile.listingKey,
      href: listingDetailPath(
        tile.listingKey,
        { streetNumber: tile.streetNumber, streetName: tile.streetName, city: tile.city },
        { city: tile.city, subdivision: tile.subdivisionName },
        { mlsNumber: tile.listNumber },
      ),
      priceLabel: formatPublishedAsk(tile.listPrice) ?? 'Price on request',
      title: publishCardAddress({
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
        city: tile.city,
      }),
      photoSrc: tile.photoUrl,
      ...(meta ? { meta } : {}),
      lat: tile.lat,
      lng: tile.lng,
      city: tile.city?.trim() ?? '',
      typeKey: type.key,
      typeLabel: type.label,
    })
  }

  return items
}

/** Mixed-type preview set. One of each type first, then fill. */
export function homeFieldPool(tiles: readonly ListingTile[], limit: number): HomeFieldItem[] {
  return takeHomeFieldByType(homeFieldItems(tiles, Number.POSITIVE_INFINITY), limit)
}
