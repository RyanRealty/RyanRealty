/**
 * Master-plan opening helpers. Stage uses an owned community photo when
 * communityImage() has one. No owned asset → belonging figures from authored
 * config only. Nothing here fetches or invents a picture.
 */

import { v3Text, type V3FieldItem, type V3InstrumentFigure } from '@/components/site/v3'
import { communityImage } from '@/lib/geo-images'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { listingTileHref } from '@/lib/slug'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import type { ListingTile } from '@/lib/data/types/listing'
import { publishPlaceHoa } from '@/lib/market/publish-place-hoa'

export function stagePoster(slug: string): string | null {
  return communityImage(slug)
}

/**
 * The page's H1. It names the PLACE — the same shape every other place grain
 * uses ("Bend homes for sale", "River West homes for sale").
 *
 * It used to pick a "belonging fact" instead, so /communities/caldera-springs
 * headlined "Master HOA is $4,380 a year." and Tetherow "Membership is
 * separate from the home." Those facts belong in the figures beside the
 * heading, which is where belongingFigures already publishes them — never as
 * the name of a premier community. (Matt 2026-08-27.)
 */
export function belongingHeadline(name: string, _content: ResortCommunityContent | null): string {
  return `${name} homes for sale`
}

export function belongingFigures(content: ResortCommunityContent | null): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  const hoa = publishPlaceHoa({ masterAnnual: content?.hoaMasterAnnual })
  if (hoa) {
    figures.push({
      value: v3Text(`$${hoa.annual.toLocaleString('en-US')}`),
      label: v3Text(hoa.kind === 'master' ? 'master HOA a year' : 'HOA estimate a year'),
    })
  }
  const tiers = (content?.membershipTiers ?? []).filter((tier) =>
    String(tier.name ?? tier.tier ?? tier.label ?? '').trim(),
  )
  if (tiers.length > 0) {
    figures.push({
      value: v3Text(String(tiers.length)),
      label: v3Text(tiers.length === 1 ? 'membership tier' : 'membership tiers'),
    })
  }
  if (content?.acres) {
    figures.push({
      value: v3Text(content.acres.toLocaleString('en-US')),
      label: v3Text('acres'),
    })
  }
  const amenityCount = (content?.amenities ?? []).length
  if (figures.length === 0 && amenityCount > 0) {
    figures.push({
      value: v3Text(String(amenityCount)),
      label: v3Text(amenityCount === 1 ? 'amenity on file' : 'amenities on file'),
    })
  }
  return figures
}

export function belongingTrace(name: string): string {
  return `Authored ${name} facts on file: membership, HOA, and the size of the plan. Not live inventory.`
}

/** The counted set as Field rows. Photo is optional. Map and list are this set. */
export function communityFieldItems(tiles: readonly ListingTile[], cap?: number): V3FieldItem[] {
  const items = [...tiles]
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .flatMap((tile) => {
      if (!tile.listingKey) return []
      const street = publishStreetLine({
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
      })
      // A fractional ask never prints unlabeled (the Camp Sherman rule).
      const shareKind = publishListingShareKind({
        propertySubType: tile.propertySubType,
        subdivisionName: tile.subdivisionName,
        city: tile.city,
        listNumber: tile.listNumber,
      })
      const meta = [
        tile.beds != null ? `${tile.beds} bd` : null,
        tile.baths != null ? `${tile.baths} ba` : null,
        tile.sqft != null ? `${tile.sqft.toLocaleString('en-US')} sqft` : null,
        shareKind,
      ]
        .filter(Boolean)
        .join(' · ')
      return [
        {
          id: tile.listingKey,
          href: listingTileHref(tile),
          priceLabel: formatPublishedAsk(tile.listPrice) ?? 'Price not published',
          title: street || 'Listing',
          photoSrc: tile.photoUrl?.trim() || undefined,
          meta: meta || undefined,
          lat: tile.lat,
          lng: tile.lng,
        } satisfies V3FieldItem,
      ]
    })
  return cap == null ? items : items.slice(0, cap)
}

/* -------------------------------------------------------------------------- */
/* The Field's caption + trace                                                */
/* -------------------------------------------------------------------------- */

/**
 * Caption beside the Field. The count is the LISTED set — the same homes the
 * list and the map render — and it names the community, never the parent city
 * (ci:place-hero-grain binds on the caption's own place interpolation here). The
 * membership count the market Instrument prints is a different population
 * (Market Truth leftover) and carries its own label there.
 */
export function communityFieldCaption(input: {
  placeName: string
  count: number
}): string | null {
  if (input.count <= 0) return null
  return `${input.count.toLocaleString('en-US')} single-family ${
    input.count === 1 ? 'home' : 'homes'
  } for sale in ${input.placeName}`
}

/** Which resolution path produced the Field's listed set. */
export type CommunityFieldBranch = 'alias' | 'boundary' | 'subdivision-name'

/** Trace over the Field's listed set, naming the path that produced it. */
export function communityFieldTrace(placeName: string, branch: CommunityFieldBranch): string {
  const FEED = 'live MLS through Oregon Data Share'
  if (branch === 'alias') {
    return (
      `${FEED}, active single-family homes matched to ${placeName} through the registry's ` +
      `subdivision aliases, the same set the alias-aware counts use. The map plots this same set`
    )
  }
  if (branch === 'boundary') {
    return (
      `${FEED}, active single-family homes inside the recorded ${placeName} boundary. ` +
      `The map plots this same set`
    )
  }
  return (
    `${FEED}, active single-family homes recorded under the ${placeName} subdivision name. ` +
    `The map plots this same set`
  )
}

