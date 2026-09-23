/**
 * The copy under a listing card's photograph: the ask, the fractional-share
 * kind, and the facts line (beds · baths · sqft · status · $/sqft).
 *
 * ONE DEFINITION, TWO CARDS. The homepage and place rails (HomeRailCardFace)
 * and the place-page dial's primary card (V3ListingDial, Matt 2026-09-23: "On
 * the primary card, it would have what we have now") print exactly this, so
 * the two cards cannot drift into two answers about one listing.
 *
 * Every value is the row's own figure run through the lib publishers:
 * formatPublishedSaleAsk withholds a lease rate and a token ask,
 * publishListingShareKind names a fractional share, and
 * publishListingSharePricePerSqft refuses a share price divided by the whole
 * dwelling (CLAUDE.md section 0). Nothing is estimated or filled in: a missing
 * figure is left out of the line, never printed as a dash or a zero.
 */
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import {
  publishListingShareKind,
  publishListingSharePricePerSqft,
} from '@/lib/listing/publish-listing-share'

export type ListingCardFactsInput = {
  price: number | null
  propertyType: string | null
  propertySubType: string | null
  subdivisionName: string | null
  city: string | null
  listNumber: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  pricePerSqft: number | null
  /** 'Pending' for an under-contract listing; null otherwise. */
  statusLabel: string | null
}

export type ListingCardFacts = {
  /** The published ask ("$649,000"), or null when there is none to publish. */
  ask: string | null
  /** A fractional share's kind ("1/4 share"), or null for a whole property. */
  kind: string | null
  /** beds · baths · sqft · status · $/sqft, only the parts the row has. */
  meta: string[]
}

function whole(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function publishListingCardFacts(card: ListingCardFactsInput): ListingCardFacts {
  const ask = formatPublishedSaleAsk({ price: card.price, propertyType: card.propertyType })
  const kind = publishListingShareKind({
    propertySubType: card.propertySubType,
    subdivisionName: card.subdivisionName,
    city: card.city,
    listNumber: card.listNumber,
  })
  const meta: string[] = []
  if (card.beds != null) meta.push(`${whole(card.beds)} bd`)
  if (card.baths != null) meta.push(`${whole(card.baths)} ba`)
  if (card.sqft != null) meta.push(`${whole(card.sqft)} sqft`)
  if (card.statusLabel) meta.push(card.statusLabel)
  const ppsf = publishListingSharePricePerSqft({
    propertyType: card.propertyType,
    propertySubType: card.propertySubType,
    subdivisionName: card.subdivisionName,
    city: card.city,
    listNumber: card.listNumber,
    pricePerSqft: card.pricePerSqft,
  })
  if (ppsf != null && ppsf > 0) meta.push(`$${whole(ppsf)}/sqft`)
  return { ask, kind, meta }
}
