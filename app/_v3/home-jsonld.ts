import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { buildJsonLd } from '@/lib/site/json-ld'
import type { HomeRailRow } from './home-rail-items'

const LIST_CAP = 8

/**
 * Crawlable ItemList of the photographed homes on the first rail.
 * Same cards the visitor sees: price + street, canonical listing URL.
 * A share ask never prints unlabeled (ci:listing-figure-publish).
 */
export function homeRailItemList(rows: readonly HomeRailRow[]): Record<string, unknown> | null {
  const cards = rows[0]?.cards.slice(0, LIST_CAP) ?? []
  const items = cards
    .map((card) => {
      const ask = formatPublishedSaleAsk({
        price: card.price,
        propertyType: card.propertyType,
      })
      const shareKind = publishListingShareKind({
        propertySubType: card.propertySubType,
        subdivisionName: card.subdivisionName,
        city: card.city,
        listNumber: card.listNumber,
      })
      const name = [ask, shareKind, card.addressLine].filter(Boolean).join(' · ')
      if (!name || !card.href) return null
      return { name, url: card.href }
    })
    .filter((item): item is { name: string; url: string } => item != null)
  if (items.length === 0) return null
  return buildJsonLd({
    type: 'itemList',
    name: 'Homes for sale in Central Oregon',
    items,
  })
}
