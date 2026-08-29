/**
 * Section shaping for the neighborhood node on the components/site/v3 barrel —
 * the Field rows, the captions, the traces, the About block, and the closing
 * edges. Nothing here fetches. Nothing here reaches outside the barrel.
 *
 * REWRITTEN 2026-08-26 for the leftover-HUD world. The 2026-08-15 revert left
 * the old copy of this module on disk carrying pulse- and stats-cache-driven
 * figure builders (liveFigures, soldFigures) that MARKET_TRUTH made wrong at
 * this grain: neighborhood is a SOLD_ATTRIBUTION_UNTRUSTED grain
 * (lib/market/geo-grain-trust.ts — bend-century-west published 48.0 months of
 * supply off a 2-close alias join against 42 real in-polygon closes), so every
 * market figure now comes off leftoverHudKpis through the shared
 * leftoverMarketFigures builder in app/cities/[slug]/_v3/city-sections.ts, and
 * the pulse builders did not survive. What lives here is what is genuinely
 * neighborhood-shaped.
 *
 * NOTHING HERE INVENTS A FIGURE, AND UNKNOWN IS NEVER ZERO (CLAUDE.md §0).
 * The Field rows publish a price only through formatPublishedAsk and an
 * address only through publishStreetLine (ci:publish-listing-ask,
 * ci:publish-street-line — both pin this file). The caption counts the LISTED
 * set and says so when a cap trimmed it.
 */

import { v3Text, type V3FieldItem, type V3QuietItem } from '@/components/site/v3'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishCardAddress, publishStreetLine } from '@/lib/listing/publish-street-line'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { listingDetailPath } from '@/lib/slug'

/** The Field lists at most this many rows — the same preview discipline the
 *  KB dual-pane list carried. The caption states the trim when it binds. */
export const FIELD_ROW_LIMIT = 24

/** One boundary tile as the Field reads it (a getListingTiles row). */
export type FieldTile = {
  listingKey: string | null | undefined
  listNumber: string | null | undefined
  listPrice: number | null | undefined
  beds: number | null | undefined
  baths: number | null | undefined
  sqft: number | null | undefined
  streetNumber: string | null | undefined
  streetName: string | null | undefined
  streetSuffix?: string | null | undefined
  propertySubType?: string | null | undefined
  city: string | null | undefined
  subdivisionName: string | null | undefined
  photoUrl: string | null | undefined
  lat: number | null | undefined
  lng: number | null | undefined
}

/**
 * A tile earns a row when it carries a price and an address — both are the
 * row's visible text and V3FieldItem types neither as optional. A photograph
 * is optional: a home with no photo is still listed and, when it has
 * coordinates, plotted. Highest price first, capped at FIELD_ROW_LIMIT.
 */
export function nbhFieldItems(tiles: readonly FieldTile[]): V3FieldItem[] {
  const items: V3FieldItem[] = []
  const sorted = [...tiles].sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
  for (const t of sorted) {
    if (items.length >= FIELD_ROW_LIMIT) break
    const key = t.listingKey?.trim()
    if (!key) continue
    if (t.listPrice == null || !Number.isFinite(t.listPrice) || t.listPrice <= 0) continue
    const street = publishStreetLine({
      streetNumber: t.streetNumber,
      streetName: t.streetName,
      streetSuffix: t.streetSuffix,
    })
    if (!street) continue
    // A fractional ask never prints unlabeled (the Camp Sherman rule).
    const shareKind = publishListingShareKind({
      propertySubType: t.propertySubType,
      subdivisionName: t.subdivisionName,
      city: t.city,
      listNumber: t.listNumber,
    })
    const meta = [
      t.beds != null ? `${t.beds} bd` : null,
      t.baths != null ? `${t.baths} ba` : null,
      t.sqft != null && t.sqft > 0 ? `${t.sqft.toLocaleString('en-US')} sqft` : null,
      shareKind,
    ]
      .filter((part): part is string => Boolean(part))
      .join(' · ')
    const photo = t.photoUrl?.trim()
    items.push({
      id: key,
      href: listingDetailPath(
        key,
        { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city },
        { city: t.city, subdivision: t.subdivisionName },
        { mlsNumber: t.listNumber },
      ),
      priceLabel: formatPublishedAsk(t.listPrice) ?? 'Price on request',
      // Every card names its city (Matt 2026-08-27): cards travel — open
      // houses, trails, price drops, saved-search alerts — so a bare street
      // line made the reader guess. Applied here too, even though the page
      // is already neighborhood-scoped: consistency beats brevity.
      title:
        publishCardAddress({
          streetNumber: t.streetNumber,
          streetName: t.streetName,
          streetSuffix: t.streetSuffix,
          city: t.city,
        }) || street,
      ...(photo ? { photoSrc: photo } : {}),
      ...(meta ? { meta } : {}),
      lat: t.lat,
      lng: t.lng,
    })
  }
  return items
}

/* -------------------------------------------------------------------------- */
/* Captions + traces                                                          */
/* -------------------------------------------------------------------------- */

const FEED = 'live MLS through Oregon Data Share'

/**
 * Caption beside the Field. The count is the LISTED set — never a pulse
 * figure, never the membership count, never pin length — and when the row cap
 * trimmed the set the caption says which slice survived. Names the
 * neighborhood, never the parent city (ci:place-hero-grain binds on the
 * caption's own place interpolation here).
 */
export function neighborhoodFieldCaption(input: {
  placeName: string
  count: number
  totalQualifying: number
}): string | null {
  if (input.count <= 0) return null
  if (input.totalQualifying > input.count) {
    return `The ${input.count.toLocaleString('en-US')} highest-priced listings in ${input.placeName}`
  }
  return `${input.count.toLocaleString('en-US')} ${input.count === 1 ? 'home' : 'homes'} for sale in ${input.placeName}`
}

/** Trace over the Field's listed set. The counted membership is named. */
export function neighborhoodFieldTrace(placeName: string): string {
  return (
    `${FEED}, active single-family homes inside the recorded ${placeName} boundary ` +
    `(the same counted set the neighborhoods index uses), each with a list price and a street. ` +
    `The map plots this same set.`
  )
}

export function nbhFieldEmptyMessage(placeName: string, readOk: boolean): string {
  return readOk
    ? `No single-family home is listed inside the ${placeName} boundary right now.`
    : 'The boundary inventory read did not answer on this refresh, so this frame is not claiming an inventory.'
}

/**
 * The trace over the Instrument's leftover-HUD figures. Same discipline as the
 * city node: every figure names its own window, a withheld cell is absent, and
 * the MoS clauses ride along only when a supply figure prints.
 */
export function neighborhoodMarketTrace(placeName: string, hasMos: boolean): string {
  return (
    `regional MLS through Oregon Data Share. ` +
    `Detached single-family houses assigned to ${placeName} by the recorded boundary polygon. ` +
    `Every figure names its own window. A figure the feed withheld is absent, not estimated.` +
    (hasMos ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')
  )
}

/** The stated absence for the no-figures render. No count of its own. */
export function neighborhoodMarketAbsenceItems(placeName: string, hasRows: boolean): V3QuietItem[] {
  const tail = hasRows ? ' The homes above carry their own live list prices.' : ''
  const body =
    `Oregon Data Share published no figure for ${placeName} on this refresh, ` +
    `so this page is not printing a median, a supply figure, or a verdict.${tail}`
  return [{ kind: 'prose', term: 'No live market figures right now', body }]
}

/* -------------------------------------------------------------------------- */
/* Quiet content                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The About block: curated prose where it exists
 * (data/resort-community-{citySlug}-{neighborhoodSlug}.json), else the
 * neighborhoods-table description — the same either/or the KB page ran. NO
 * FIGURES: a number belongs in the Instrument with its source line, which is
 * V3Quiet's own contract. Empty input returns nothing and the block does not
 * render, never generated filler.
 */
export function neighborhoodAboutItems(input: {
  curatedProse: readonly string[] | null | undefined
  description: string | null | undefined
  cityName: string
}): V3QuietItem[] {
  const items: V3QuietItem[] = []
  const prose =
    input.curatedProse && input.curatedProse.length > 0
      ? input.curatedProse
      : [input.description?.trim() ?? ''].filter(Boolean)
  for (const p of prose) {
    const body = p.trim()
    if (body) items.push({ kind: 'prose', body })
  }
  if (items.length > 0) items.push({ kind: 'prose', term: 'City', body: input.cityName })
  return items
}

/**
 * The closing edges. `links.valuation` arrives from lib/site/valuation-href.ts
 * so the seller lead's stored source_url names this neighborhood page.
 */
export function neighborhoodExploreItems(input: {
  placeName: string
  cityName: string
  citySlug: string
  links: { browse: string; valuation: string }
}): V3QuietItem[] {
  return [
    { label: `See every ${input.placeName} home for sale`, href: input.links.browse },
    { label: `${input.cityName} market report`, href: `/housing-market/${input.citySlug}` },
    { label: `Open houses in ${input.cityName}`, href: `/open-houses/${input.citySlug}` },
    { label: `All of ${input.cityName}`, href: `/cities/${input.citySlug}` },
    { label: 'Every neighborhood', href: '/neighborhoods' },
    { label: 'Value my home', href: input.links.valuation },
    { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
  ]
}
