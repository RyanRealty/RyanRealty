/**
 * Master-plan opening helpers. Stage uses an owned community photo when
 * one exists. The registered Imagine place still wins over a leftover live
 * crop, then live `hero_image_url`, then a geo-strict library still, then
 * communityImage(). Area-guide clips stay off Stage (they are click-to-play
 * guides, never a silent looping hero). Nothing here invents a picture.
 */

import type { ListingTileRow } from '@/app/actions/listings'
import { v3Text, type V3FieldItem, type V3InstrumentFigure } from '@/components/site/v3'
import { getSurfaceImage } from '@/lib/data'
import { publicSegmentBrowseHref, publicSegmentNoun } from '@/lib/data/market-truth/public-segments'
import type { PublicPaceRow } from '@/lib/data/market-truth/public-pace'
import type { PlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatPriceExact } from '@/lib/format/money'
import { communityImage, preferPlaceHeroOrNull } from '@/lib/geo-images'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishCardAddress } from '@/lib/listing/publish-street-line'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { publishPlaceHoa } from '@/lib/market/publish-place-hoa'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import { listingTileHref } from '@/lib/slug'
import { measuredPlaceHoaInput } from './place-hoa-measured'

function imaginePlaceStill(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const trimmed = url?.trim()
    if (trimmed && trimmed.includes('imagine-place-')) return trimmed
  }
  return null
}

export async function communityLibraryHero(slug: string): Promise<string | null> {
  return getSurfaceImage('hero', {
    geoTags: [slug],
    seed: `community:${slug}`,
    geoOnly: true,
  })
}

export function stagePoster(
  slug: string,
  liveHero?: string | null,
  libraryHero?: string | null,
): string | null {
  return (
    imaginePlaceStill(libraryHero, liveHero) ??
    preferPlaceHeroOrNull(liveHero, preferPlaceHeroOrNull(libraryHero, communityImage(slug)))
  )
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

export function belongingFigures(
  content: ResortCommunityContent | null,
  character?: PlaceCharacter | null,
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  // A measured median (live member listings) outranks the master assessment
  // here exactly as it does in the closing knowledge row and FAQ, so this
  // glance figure cannot disagree with either one. (§0, D103 2026-08-27)
  const { measuredAnnual, measuredBasis } = measuredPlaceHoaInput(character)
  const hoa = publishPlaceHoa({ measuredAnnual, measuredBasis, masterAnnual: content?.hoaMasterAnnual })
  if (hoa) {
    figures.push({
      value: v3Text(`$${hoa.annual.toLocaleString('en-US')}`),
      label: v3Text(
        hoa.kind === 'measured' ? 'measured HOA a year' : hoa.kind === 'master' ? 'master HOA a year' : 'HOA estimate a year',
      ),
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
      const cardAddress = publishCardAddress({
        streetNumber: tile.streetNumber,
        streetName: tile.streetName,
        streetSuffix: tile.streetSuffix,
        city: tile.city,
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
          title: cardAddress || 'Listing',
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

/** First authored paragraph only. Miss omits. Never dump the full about array. */
export function firstAboutParagraph(paragraphs: readonly string[]): string | null {
  for (const paragraph of paragraphs) {
    const body = paragraph.trim()
    if (body) return body
  }
  return null
}

/** Eagle Crest is Redmond 2J. Other communities use their registry city. */
export function communitySchoolCity(slug: string, cityName: string): string {
  return slug === 'eagle-crest' ? 'Redmond' : cityName
}

/**
 * Leftover sold history as its own series. Median close / sold count / DTP
 * when leftover still publishes them. MOS stays off this set.
 */
export function leftoverSoldHistoryFigures(
  hud: LeftoverHudKpis,
  pace: PublicPaceRow,
): V3InstrumentFigure[] {
  const figures: V3InstrumentFigure[] = []
  if (pace.medianClose != null && pace.medianClose > 0) {
    figures.push({
      value: v3Text(formatPriceExact(pace.medianClose)),
      label: v3Text('median sale price, last 12 months'),
    })
  }
  if (hud.sold12mo != null && hud.sold12mo > 0) {
    figures.push({
      value: v3Text(hud.sold12mo.toLocaleString('en-US')),
      label: v3Text('homes sold, last 12 months'),
    })
  }
  const daysToPending = publishDaysFigure(hud.daysToPending)
  if (daysToPending) {
    figures.push({
      value: v3Text(daysToPending),
      label: v3Text('days to an offer, last 90 days'),
    })
  }
  return figures
}

export type CommunityTypeStripItem = { key: string; href: string; label: string }

/** Type chips, not H2s. Count + noun only. MOS / verdict stay off. */
export function communityTypeStripItems(
  rows: readonly { segment: string; activeCount: number | null }[],
  citySlug: string | null,
): CommunityTypeStripItem[] {
  return rows.flatMap((row) => {
    const count = row.activeCount
    if (count == null || count <= 0) return []
    const noun = publicSegmentNoun(row.segment, count)
    return [
      {
        key: row.segment,
        href: publicSegmentBrowseHref(citySlug, row.segment),
        label: `${count.toLocaleString('en-US')} ${noun}`,
      },
    ]
  })
}

/** Alias / in-boundary tiles as Split rows. Face count does not read this length. */
export function communitySplitListings(tiles: readonly ListingTile[]): ListingTileRow[] {
  return tiles.map((tile) => ({
    ListingKey: tile.listingKey,
    ListNumber: tile.listNumber,
    ListPrice: tile.listPrice,
    BedroomsTotal: tile.beds,
    BathroomsTotal: tile.baths,
    StreetNumber: tile.streetNumber,
    StreetName: tile.streetName,
    StreetSuffix: tile.streetSuffix ?? null,
    City: tile.city,
    State: 'OR',
    PostalCode: tile.postalCode,
    SubdivisionName: tile.subdivisionName,
    PhotoURL: tile.photoUrl,
    Latitude: tile.lat,
    Longitude: tile.lng,
    StandardStatus: tile.status ?? null,
    TotalLivingAreaSqFt: tile.sqft ?? null,
    PropertyType: tile.propertyType ?? null,
    PropertySubType: tile.propertySubType ?? null,
    OnMarketDate: tile.onMarketDate ?? null,
    CloseDate: tile.closeDate ?? null,
    ClosePrice: tile.closePrice ?? null,
  }))
}

