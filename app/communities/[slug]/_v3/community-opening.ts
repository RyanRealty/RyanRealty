/**
 * Master-plan opening helpers. Stage uses an owned community photo when
 * one exists. The registered Imagine place still wins over a live crop,
 * then live `hero_image_url`, then a geo-strict library still, then
 * communityImage(). Area-guide clips stay off Stage (they are click-to-play
 * guides, never a silent looping hero). Nothing here invents a picture.
 * Unsplash and Google map pixels never reach Stage.
 */

import { v3Text, type V3FieldItem, type V3InstrumentFigure } from '@/components/site/v3'
import { getSurfaceImage } from '@/lib/data'
import { communityImage, preferPlaceHeroOrNull } from '@/lib/geo-images'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishCardAddress } from '@/lib/listing/publish-street-line'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { listingTileHref } from '@/lib/slug'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import type { ListingTile } from '@/lib/data/types/listing'
import type { PlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { publishPlaceHoa } from '@/lib/market/publish-place-hoa'
import { measuredPlaceHoaInput } from './place-hoa-measured'

const TYPE_ORDER = [
  'house',
  'condo',
  'townhouse',
  'manufactured',
  'multi',
  'land',
  'commercial',
  'other',
] as const

export type CommunityFieldTypeKey = (typeof TYPE_ORDER)[number]

export type CommunityFieldItem = V3FieldItem & {
  typeKey: CommunityFieldTypeKey
  typeLabel: string
  cat: 0 | 1 | 2 | 3 | 4
}

function classifyType(input: {
  propertyType?: string | null
  propertySubType?: string | null
}): { typeKey: CommunityFieldTypeKey; typeLabel: string } {
  const sub = (input.propertySubType ?? '').trim()
  const cls = (input.propertyType ?? '').trim().toUpperCase()

  switch (sub) {
    case 'Single Family Residence':
    case 'Tenancy in Common':
    case 'Residential Leased Land':
    case 'Stock Cooperative':
    case 'Timeshare':
      return { typeKey: 'house', typeLabel: 'House' }
    case 'Condominium':
      return { typeKey: 'condo', typeLabel: 'Condo' }
    case 'Townhouse':
      return { typeKey: 'townhouse', typeLabel: 'Townhouse' }
    case 'Manufactured On Land':
    case 'In Park':
    case 'On Leased Land':
      return { typeKey: 'manufactured', typeLabel: 'Manufactured' }
    case 'Duplex':
    case 'Triplex':
    case 'Quadruplex':
    case 'Multi Family':
      return { typeKey: 'multi', typeLabel: 'Multi-family' }
    case 'Residential Lots':
    case 'Recreational':
    case 'Agriculture':
    case 'Rangeland':
    case 'Investment':
    case 'Industrial':
      return { typeKey: 'land', typeLabel: 'Land' }
    default:
      break
  }

  if (cls === 'D' || cls === 'E') return { typeKey: 'land', typeLabel: 'Land' }
  if (cls === 'C') return { typeKey: 'multi', typeLabel: 'Multi-family' }
  if (cls === 'B') return { typeKey: 'manufactured', typeLabel: 'Manufactured' }
  if (cls === 'F' || cls === 'G' || cls === 'H') {
    return { typeKey: 'commercial', typeLabel: 'Commercial' }
  }
  return { typeKey: 'house', typeLabel: 'House' }
}

function withCats(items: readonly Omit<CommunityFieldItem, 'cat'>[]): CommunityFieldItem[] {
  const present = TYPE_ORDER.filter((key) => items.some((item) => item.typeKey === key))
  const catByKey = new Map(
    present.map((key, index) => [key, (index % 5) as CommunityFieldItem['cat']]),
  )
  return items.map((item) => ({
    ...item,
    cat: catByKey.get(item.typeKey) ?? 0,
  }))
}

function isImaginePlaceUrl(url: string): boolean {
  return url.includes('imagine-place-') || url.includes('/grok-imagine/')
}

function isStockOrMapPixel(url: string): boolean {
  return /unsplash|images\.unsplash|maps\.googleapis|maps\.gstatic|googleusercontent|lh3\.google|streetviewpixels|khms|mt[01]\.google/i.test(
    url,
  )
}

function usableStageStill(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (isStockOrMapPixel(trimmed)) return null
  return trimmed
}

function imaginePlaceStill(...urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const trimmed = usableStageStill(url)
    if (trimmed && isImaginePlaceUrl(trimmed)) return trimmed
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
    preferPlaceHeroOrNull(
      usableStageStill(liveHero),
      preferPlaceHeroOrNull(usableStageStill(libraryHero), usableStageStill(communityImage(slug))),
    )
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
export function communityFieldItems(tiles: readonly ListingTile[], cap?: number): CommunityFieldItem[] {
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
      const type = classifyType({
        propertyType: tile.propertyType,
        propertySubType: tile.propertySubType,
      })
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
          typeKey: type.typeKey,
          typeLabel: type.typeLabel,
        } satisfies Omit<CommunityFieldItem, 'cat'>,
      ]
    })
  const typed = withCats(items)
  return cap == null ? typed : typed.slice(0, cap)
}

/* -------------------------------------------------------------------------- */
/* The Field's caption + trace                                                */
/* -------------------------------------------------------------------------- */

/**
 * Caption beside the Field. The count is the LISTED set — the same homes the
 * list and the map render — and it names the community, never the parent city
 * (ci:place-hero-grain binds on the caption's own place interpolation here). The
 * membership count the market Instrument prints is a different population
 * and carries its own label there.
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

