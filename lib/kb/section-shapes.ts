/**
 * The four row shapes the place-section builders emit.
 *
 * They were declared on the KB components that consumed them
 * (KbActivity.client, KbArticles, KbListingMapImpl, KbOpenHouses.client). Those
 * components were deleted on 2026-08-27 when the KB register was retired, and
 * lib/kb/place-sections.ts still needs the SHAPES -- so the shapes moved here,
 * byte-for-byte, and the components went. A data shape is not a design
 * register: nothing in this file renders anything.
 */

export interface KbActivityItem {
  /** Drives the kind-tag + its weight. Known kinds get a fixed label/intent;
   *  any other string renders its own `label` verbatim. */
  kind: 'new' | 'price_drop' | 'pending' | 'sold' | string
  /** Display label for the kind-tag (e.g. "NEW", "PRICE CUT"). */
  label: string
  address: string
  cityLine?: string
  price: number | null
  href?: string
  whenLabel?: string
  /** Listing primary photo for the row thumbnail. Null -> hatched placeholder tile. */
  imageUrl?: string | null
}

export interface KbArticlePost {
  title: string
  href: string
  excerpt?: string | null
  imageUrl?: string | null
  dateLabel?: string | null
}

export type KbMapFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    p: number | null
    bd: number | null
    ba: number | null
    sf: number | null
    a: string
    sub: string
    city: string
    img: string
    /** ListingKey for dual-pane list↔map highlight */
    k?: string
    /** Canonical /homes-for-sale/... detail path (popup + pin navigate here) */
    href?: string
  }
}

export interface KbOpenHouseItem {
  href: string
  photoUrl: string | null
  price: number | null
  address: string
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  /** Pre-formatted human date/time, e.g. "Sat 11am-1pm". */
  whenLabel: string
}
