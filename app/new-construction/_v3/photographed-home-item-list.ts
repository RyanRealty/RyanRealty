/**
 * SITE-175. ItemList of the photographed homes on /new-construction.
 * Reuses listingItemListFromHomes — do not fork a second listing helper.
 */
import { buildJsonLd, listingItemListFromHomes } from '@/lib/site/json-ld'

export const NEW_CON_PHOTOGRAPHED_HOME_ITEM_LIST_NAME =
  'Live photographed Bend new-construction homes'

export type PhotographedNewConCard = {
  href: string
  addressLine: string
  price: number | null
  propertyType: string | null
  propertySubType?: string | null
  subdivisionName?: string | null
  city?: string | null
  listNumber?: string | null
  photoUrls: readonly string[]
}

export function photographedNewConHomeItemList(
  cards: ReadonlyArray<PhotographedNewConCard>,
) {
  return listingItemListFromHomes(
    NEW_CON_PHOTOGRAPHED_HOME_ITEM_LIST_NAME,
    cards.map((card) => ({
      href: card.href,
      addressLine: card.addressLine,
      price: card.price,
      propertyType: card.propertyType,
      propertySubType: card.propertySubType,
      subdivisionName: card.subdivisionName,
      city: card.city,
      listNumber: card.listNumber,
      photoUrl: card.photoUrls.find((src) => src.trim()) ?? null,
    })),
  )
}

/** Absolute ItemList JSON-LD, or null when the shelf has no photographed homes. */
export function photographedNewConHomeJsonLd(
  cards: ReadonlyArray<PhotographedNewConCard>,
): Record<string, unknown> | null {
  const list = photographedNewConHomeItemList(cards)
  return list ? buildJsonLd(list) : null
}
