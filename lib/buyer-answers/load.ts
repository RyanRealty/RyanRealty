import {
  getCityListings,
  getCommunityBySlug,
  getGeoBoundaryMapData,
  getListingTiles,
  getMarketPulse,
  getResortCommunityBySlug,
} from '@/lib/data'
import {
  BEND_NEIGHBORHOOD_DISTRICTS,
  getNeighborhoodPublicInventory,
  neighborhoodGeoSlug,
} from '@/lib/data/geo/neighborhood-public-inventory'
import { getPlaceCharacter } from '@/lib/data/places/getPlaceCharacter'
import { measuredPlaceHoaInput } from '@/app/communities/[slug]/_v3/place-hoa-measured'
import { publishPlaceHoa } from '@/lib/market/publish-place-hoa'
import { trustedCommunityOutlineSlug } from '@/lib/communities/community-outline'
import {
  communityPath,
  resolveDurableCommunitySlug,
  resolvePublicCommunitySlug,
} from '@/lib/communities/community-public-pair'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import type { ListingTile, MarketPulse } from '@/lib/data'
import type { BuyerAnswerDef, BuyerAnswerFigures, BuyerAnswerModel } from './types'
import { buyerAnswerByPath } from './registry'
import { BUY_LINKS, buildAnswer, buyerAnswerByline } from './copy'
import { buildFaqs } from './faq'
import { formatDays, formatMlsDate, formatMos, formatUsd, formatUsdExact, mlsCitation } from './format'
import { buyerAnswerListingRows } from './listings'
import { masterHoaAnnual, sourcedStr } from './sourced'

const LISTING_LIMIT = 12

function cityDisplayName(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function cityMlsName(slug: string): string {
  if (slug === 'la-pine') return 'La Pine'
  if (slug === 'black-butte-ranch') return 'Black Butte Ranch'
  return cityDisplayName(slug)
}

async function readPulse(geoType: 'city' | 'neighborhood', geoSlug: string): Promise<MarketPulse | null> {
  return getMarketPulse({ geoType, geoSlug }).catch(() => null)
}

async function readCommunityListings(publicSlug: string, city: string, subdivision: string | null): Promise<ListingTile[]> {
  const outlineSlug = trustedCommunityOutlineSlug(publicSlug)
  if (outlineSlug) {
    const boundary = await getGeoBoundaryMapData({
      geoType: 'neighborhood',
      geoSlug: outlineSlug,
    }).catch(() => null)
    const keys = (boundary?.pins ?? []).map((pin) => pin.listingKey).filter(Boolean)
    if (keys.length > 0) {
      return getListingTiles({
        listingKeys: keys.slice(0, 500),
        status: 'active',
        sort: 'newest',
        limit: LISTING_LIMIT,
      }).catch(() => [])
    }
  }
  if (subdivision) {
    return getListingTiles({
      city,
      subdivision,
      status: 'active',
      sort: 'newest',
      limit: LISTING_LIMIT,
    }).catch(() => [])
  }
  return []
}

async function readCityListings(cityName: string): Promise<ListingTile[]> {
  return getCityListings(cityName, { status: 'active', sort: 'newest', limit: LISTING_LIMIT }).catch(() => [])
}

type PlaceBundle = {
  figures: BuyerAnswerFigures
  tiles: ListingTile[]
}

async function loadCommunityFigures(publicSlug: string): Promise<PlaceBundle | null> {
  const community = await getCommunityBySlug(publicSlug).catch(() => null)
  const registry = getResortCommunityBySlug(publicSlug)
  if (!community && !registry) return null
  const durable = resolveDurableCommunitySlug(publicSlug)
  const publicName = registry?.label ?? community?.name ?? cityDisplayName(publicSlug)
  const cityName = registry?.city ?? community?.city ?? 'Central Oregon'
  const citySlug = registry?.city_slug ?? community?.citySlug ?? 'bend'
  const [pulse, character, tiles] = await Promise.all([
    readPulse('neighborhood', durable),
    getPlaceCharacter('neighborhood', durable).catch(() => null),
    readCommunityListings(publicSlug, cityName, community?.subdivision ?? registry?.label ?? null),
  ])
  const measured = measuredPlaceHoaInput(character, publicName)
  const hoa = publishPlaceHoa({
    measuredAnnual: measured.measuredAnnual,
    measuredBasis: measured.measuredBasis,
    masterAnnual: masterHoaAnnual(durable),
  })
  return {
    figures: {
      name: publicName,
      publicSlug: resolvePublicCommunitySlug(publicSlug),
      durableSlug: durable,
      placeKind: 'community',
      cityName,
      citySlug,
      hubHref: communityPath(publicSlug),
      activeCount: pulse?.activeCount ?? community?.activeCount ?? (tiles.length > 0 ? tiles.length : null),
      medianListPrice: pulse?.medianListPrice ?? community?.medianPrice ?? null,
      monthsOfSupply: pulse?.monthsOfSupply ?? null,
      medianDaysToPending: pulse?.medianDaysToPending ?? null,
      closedLast30Days: pulse?.closedLast30Days ?? null,
      refreshedAt: pulse?.refreshedAt ?? null,
    hoaAnnual: hoa && hoa.kind !== 'estimate' ? hoa.annual : null,
    hoaKind: hoa && hoa.kind !== 'estimate' ? hoa.kind : null,
    hoaBasis:
      hoa && hoa.kind === 'measured' && measured.measuredReported
        ? `median of ${measured.measuredReported.toLocaleString('en-US')} listings since October 2023`
        : null,
      listingCount: tiles.length,
    },
    tiles,
  }
}

async function loadCityFigures(citySlug: string): Promise<PlaceBundle | null> {
  const name = cityDisplayName(citySlug)
  const pulse = await readPulse('city', canonicalCityCacheSlug(citySlug))
  const tiles = await readCityListings(cityMlsName(citySlug))
  return {
    figures: {
      name,
      publicSlug: citySlug,
      durableSlug: citySlug,
      placeKind: 'city',
      cityName: name,
      citySlug,
      hubHref: `/cities/${citySlug}`,
      activeCount: pulse?.activeCount ?? (tiles.length > 0 ? tiles.length : null),
      medianListPrice: pulse?.medianListPrice ?? null,
      monthsOfSupply: pulse?.monthsOfSupply ?? null,
      medianDaysToPending: pulse?.medianDaysToPending ?? null,
      closedLast30Days: pulse?.closedLast30Days ?? null,
      refreshedAt: pulse?.refreshedAt ?? null,
      hoaAnnual: null,
      hoaKind: null,
      hoaBasis: null,
      listingCount: tiles.length,
    },
    tiles,
  }
}

async function loadNeighborhoodFigures(hoodSlug: string): Promise<PlaceBundle | null> {
  const district = BEND_NEIGHBORHOOD_DISTRICTS.find((row) => row.slug === hoodSlug)
  if (!district) return null
  const geoSlug = neighborhoodGeoSlug('bend', hoodSlug)
  const [inventory, pulse] = await Promise.all([
    getNeighborhoodPublicInventory(geoSlug).catch(() => null),
    readPulse('neighborhood', geoSlug),
  ])
  // Public inventory SoR is listing_boundary_xref_mv. Pulse active_count
  // includes Coming Soon and is not this figure. A silent inventory read
  // does not fall back to pulse.
  if (!inventory) return null
  const keys = inventory.listingKeys.filter(Boolean)
  const tiles =
    keys.length > 0
      ? await getListingTiles({
          listingKeys: keys.slice(0, 500),
          status: 'active',
          sort: 'newest',
          limit: LISTING_LIMIT,
        }).catch(() => [])
      : []
  return {
    figures: {
      name: district.label,
      publicSlug: hoodSlug,
      durableSlug: geoSlug,
      placeKind: 'neighborhood',
      cityName: 'Bend',
      citySlug: 'bend',
      hubHref: `/cities/bend/${hoodSlug}`,
      activeCount: inventory.activeCount,
      medianListPrice: inventory.medianListPrice ?? pulse?.medianListPrice ?? null,
      monthsOfSupply: pulse?.monthsOfSupply ?? null,
      medianDaysToPending: pulse?.medianDaysToPending ?? null,
      closedLast30Days: pulse?.closedLast30Days ?? null,
      refreshedAt: pulse?.refreshedAt ?? null,
      hoaAnnual: null,
      hoaKind: null,
      hoaBasis: null,
      listingCount: tiles.length,
    },
    tiles,
  }
}

async function loadPlace(
  kind: 'community' | 'city' | 'neighborhood',
  slug: string,
): Promise<PlaceBundle | null> {
  if (kind === 'community') return loadCommunityFigures(slug)
  if (kind === 'neighborhood') return loadNeighborhoodFigures(slug)
  return loadCityFigures(slug)
}

function tableRows(place: BuyerAnswerFigures, other?: BuyerAnswerFigures | null) {
  const rows: { label: string; value: string }[] = []
  if (place.activeCount != null) {
    rows.push({ label: `${place.name} for sale`, value: String(place.activeCount) })
  }
  if (place.medianListPrice != null && place.medianListPrice > 0) {
    rows.push({ label: `${place.name} median list`, value: formatUsd(place.medianListPrice) })
  }
  const days = formatDays(place.medianDaysToPending)
  if (days) {
    rows.push({ label: `${place.name} days to pending`, value: days })
  }
  const mos = formatMos(place.monthsOfSupply)
  if (mos) rows.push({ label: `${place.name} months of supply`, value: mos })
  if (place.hoaAnnual != null) {
    rows.push({
      label: place.hoaKind === 'measured' ? `${place.name} HOA (measured)` : `${place.name} master HOA`,
      value: `${formatUsdExact(place.hoaAnnual)}/yr`,
    })
  }
  if (other) {
    if (other.activeCount != null) {
      rows.push({ label: `${other.name} for sale`, value: String(other.activeCount) })
    }
    if (other.medianListPrice != null && other.medianListPrice > 0) {
      rows.push({ label: `${other.name} median list`, value: formatUsd(other.medianListPrice) })
    }
    const otherDays = formatDays(other.medianDaysToPending)
    if (otherDays) {
      rows.push({ label: `${other.name} days to pending`, value: otherDays })
    }
    const otherMos = formatMos(other.monthsOfSupply)
    if (otherMos) rows.push({ label: `${other.name} months of supply`, value: otherMos })
  }
  return rows
}

export async function loadBuyerAnswer(path: string): Promise<BuyerAnswerModel | null> {
  const def = buyerAnswerByPath(path)
  if (!def) return null
  if (def.kind === 'preset' || def.kind === 'new-construction') return null

  const bundle = await loadPlace(def.placeKind, def.slug)
  if (!bundle) return null
  const place = bundle.figures

  if (def.kind === 'hoa' && place.hoaAnnual == null) return null
  const str = def.kind === 'str' ? sourcedStr(def.slug) : null
  if (def.kind === 'str' && !str) return null

  const otherBundle =
    def.kind === 'vs' && def.otherSlug
      ? await loadPlace(def.otherPlaceKind ?? def.placeKind, def.otherSlug)
      : null
  if (def.kind === 'vs' && !otherBundle) return null
  const other = otherBundle?.figures ?? null

  const tiles =
    def.kind === 'vs' && otherBundle
      ? [...bundle.tiles, ...otherBundle.tiles].slice(0, LISTING_LIMIT)
      : bundle.tiles
  const asOfIso = place.refreshedAt ?? other?.refreshedAt ?? null
  const asOfLabel = formatMlsDate(asOfIso)
  const rows = tableRows(place, other)
  if (rows.length === 0) return null

  const hubNoun =
    place.placeKind === 'city' ? 'city page' : place.placeKind === 'neighborhood' ? 'neighborhood page' : 'community page'
  const listingsPlace = other ? `${place.name} and ${other.name}` : place.name

  return {
    def,
    answer: buildAnswer({ def, place, other, str, asOf: asOfLabel }),
    citation: mlsCitation(asOfLabel),
    asOfLabel,
    asOfIso,
    table: {
      caption: other
        ? `${place.name} and ${other.name}, ${mlsCitation(asOfLabel)}`
        : `${place.name}, ${mlsCitation(asOfLabel)}`,
      rows,
    },
    faqs: buildFaqs({ def, place, other, str, asOf: asOfLabel }),
    placeName: place.name,
    hub: { href: place.hubHref, label: `${place.name} ${hubNoun}` },
    buyLinks: [...BUY_LINKS],
    byline: buyerAnswerByline(),
    listings: buyerAnswerListingRows(tiles),
    listingsHeading:
      tiles.length === 1 ? `1 home for sale` : `Homes for sale in ${listingsPlace}`,
    listingsEmpty: `No matching homes are for sale in ${listingsPlace} right now.`,
    listingsHref: `/homes-for-sale/${place.citySlug}`,
    otherHub: other ? { href: other.hubHref, label: `${other.name} page` } : undefined,
  }
}

export async function loadBuyerAnswerForSlugs(input: {
  kind: BuyerAnswerDef['kind']
  slug: string
  other?: string
  placeKind: BuyerAnswerDef['placeKind']
}): Promise<BuyerAnswerModel | null> {
  const path =
    input.kind === 'vs' && input.other
      ? input.placeKind === 'city'
        ? `/cities/${input.slug}/vs/${input.other}`
        : `${communityPath(input.slug)}/vs/${input.other}`
      : input.kind === 'str'
        ? `${communityPath(input.slug)}/short-term-rentals`
        : input.placeKind === 'neighborhood'
          ? `/cities/bend/${input.slug}/${input.kind}`
          : input.placeKind === 'city'
            ? `/cities/${input.slug}/${input.kind}`
            : `${communityPath(input.slug)}/${input.kind}`
  return loadBuyerAnswer(path)
}
