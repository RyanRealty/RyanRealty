/**
 * Listing keep-exploring doors — View more + related-place Atlas chips.
 *
 * The similar-homes "View more" control must land on this home's subdivision
 * (or the next visitor place), never generic /homes-for-sale search.
 *
 * Listing Atlas chips are the related-places chrome. A city frame that dumps
 * 60 legal plats reads as "+52 more" at 375 (CHIP_FOLD_AT is 8). Keep the
 * home's own plat and a handful of visitor-facing siblings. Do not twin the
 * listing breadcrumb hierarchy or amenity layers.
 */
import { publishPlatDisplayName } from '@/lib/market/publish-plat-display-name'
import { slugify } from '@/lib/slug'
import { subdivisionHref } from '@/lib/site/place-href'
import {
  isPermitGluedPlatSlug,
  isVisitorPlaceNoiseLabel,
  isVisitorPlaceNoiseSlug,
} from '@/lib/site/visitor-place-noise'

/** Must stay in lockstep with V3Atlas CHIP_FOLD_AT — 375 shows "+ N more" past this. */
export const LISTING_KEEP_EXPLORING_CHIP_FOLD_AT = 8

/** Plats beside a frame region so frame + plats never trip "+ N more" at 375. */
export const LISTING_ATLAS_RELATED_PLAT_CAP_WITH_FRAME = LISTING_KEEP_EXPLORING_CHIP_FOLD_AT - 1

/** No frame region: the chip rail can hold this many plats before it folds. */
export const LISTING_ATLAS_RELATED_PLAT_CAP_NO_FRAME = LISTING_KEEP_EXPLORING_CHIP_FOLD_AT

export type ListingKeepExploringNode = {
  label: string
  slug: string
  href?: string
}

export type ListingKeepExploringDoor = {
  name: string
  href: string
}

function visitorPlatDoor(label: string | null | undefined, slug: string | null | undefined): ListingKeepExploringDoor | null {
  const rawLabel = (label ?? '').trim()
  const rawSlug = (slug ?? '').trim().toLowerCase()
  if (!rawLabel || !rawSlug) return null
  if (isVisitorPlaceNoiseLabel(rawLabel) || isVisitorPlaceNoiseSlug(rawSlug) || isPermitGluedPlatSlug(rawSlug)) {
    return null
  }
  const name = publishPlatDisplayName(rawLabel)
  const href = subdivisionHref(rawSlug)
  if (!name || !href) return null
  return { name, href }
}

function placePageDoor(node: ListingKeepExploringNode | null | undefined): ListingKeepExploringDoor | null {
  if (!node?.label?.trim() || !node.slug?.trim()) return null
  if (isVisitorPlaceNoiseLabel(node.label) || isVisitorPlaceNoiseSlug(node.slug) || isPermitGluedPlatSlug(node.slug)) {
    return null
  }
  const href = node.href?.trim()
  if (!href || href === '/homes-for-sale' || href === '/homes-for-sale/') return null
  if (/^\/homes-for-sale\/[^/]+\/?$/.test(href)) return null
  return { name: node.label.trim(), href }
}

/**
 * Similar-homes "View more" target. Finest visitor subdivision first.
 * Never /homes-for-sale or a city-only search path.
 */
export function listingKeepExploringDoor(input: {
  subdivision?: ListingKeepExploringNode | null
  aliasPlat?: ListingKeepExploringNode | null
  aliasParent?: ListingKeepExploringNode | null
  curatedCommunity?: ListingKeepExploringNode | null
  neighborhood?: ListingKeepExploringNode | null
  city?: ListingKeepExploringNode | null
  boundarySubdivision?: string | null
}): ListingKeepExploringDoor {
  const boundaryPublished = publishPlatDisplayName(input.boundarySubdivision)
  const boundarySlug = boundaryPublished ? slugify(boundaryPublished) : null

  const door =
    visitorPlatDoor(input.aliasPlat?.label, input.aliasPlat?.slug) ??
    visitorPlatDoor(input.subdivision?.label, input.subdivision?.slug) ??
    visitorPlatDoor(boundaryPublished, boundarySlug) ??
    visitorPlatDoor(input.aliasParent?.label, input.aliasParent?.slug) ??
    placePageDoor(input.curatedCommunity) ??
    placePageDoor(input.neighborhood) ??
    placePageDoor(input.city)

  if (door) return door
  return { name: 'Nearby', href: '/cities/bend' }
}

export type ListingAtlasPlatPick = {
  slug: string
  label: string
  activeHomes?: number
}

export function isListingAtlasVisitorPlat(plat: ListingAtlasPlatPick): boolean {
  if (!plat.slug?.trim() || !plat.label?.trim()) return false
  if (isPermitGluedPlatSlug(plat.slug) || isVisitorPlaceNoiseSlug(plat.slug)) return false
  if (isVisitorPlaceNoiseLabel(plat.label)) return false
  return publishPlatDisplayName(plat.label) != null
}

/**
 * Related-place chip set for the listing Atlas. City frames keep the subject
 * plat only — never the 60-plat legal dump. A neighborhood / community frame
 * may add visitor-facing siblings up to the 375 fold.
 */
export function pickListingAtlasRelatedPlats<T extends ListingAtlasPlatPick>(input: {
  plats: readonly T[]
  subject: T | null
  hasLocalFrame: boolean
}): T[] {
  const cap = input.hasLocalFrame
    ? LISTING_ATLAS_RELATED_PLAT_CAP_WITH_FRAME
    : LISTING_ATLAS_RELATED_PLAT_CAP_NO_FRAME

  if (!input.hasLocalFrame) {
    return input.subject ? [input.subject] : []
  }

  const out: T[] = []
  if (input.subject) out.push(input.subject)

  const siblings = input.plats
    .filter((plat) => plat !== input.subject && isListingAtlasVisitorPlat(plat))
    .sort((a, b) => (b.activeHomes ?? 0) - (a.activeHomes ?? 0) || a.label.localeCompare(b.label))

  for (const plat of siblings) {
    if (out.length >= cap) break
    if (out.some((kept) => kept.slug === plat.slug)) continue
    out.push(plat)
  }
  return out
}
