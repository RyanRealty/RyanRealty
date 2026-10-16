/**
 * Sarah home search. Parses visitor criteria, reads active listings from
 * listing_search_mv via searchListingsAll (docs/DATABASE_FOR_AI_AGENTS.md §0,
 * same source as /homes-for-sale), and returns compact cards plus a See-all
 * URL that reuses the site's search params.
 *
 * Property criteria only. No steering or neighborhood-character claims.
 * Client panel imports home-search-parse, not this file.
 */
import { searchListingsAll, pickSearchFeatureFilters } from '@/lib/data/listings/searchListingsAll'
import type { SearchListingsAllFilter } from '@/lib/data/listings/searchListingsAll'
import type { ListingTile } from '@/lib/data/types/listing'
import { formatPriceExact } from '@/lib/format/money'
import { publishCardAddress } from '@/lib/listing/publish-street-line'
import { coerceRegistryParams } from '@/lib/search/field-registry'
import { homesForSalePath, listingTileHref } from '@/lib/slug'
import {
  HOME_SEARCH_CARD_MAX,
  assertFairHousingCopy,
  criteriaFromParsed,
  criteriaLabel,
  followUpAsk,
  followUpKind,
  homeSearchSeeAllHref,
  homesWord,
  matchCopy,
  parseHomeSearch,
  cleanHomeSearchParsed,
  type HomeSearchCard,
  type HomeSearchTurn,
} from './home-search-parse'

export {
  FAIR_HOUSING_BAN_RE,
  HOME_SEARCH_CARD_MAX,
  SARAH_SEARCH_ALERTS,
  SARAH_SEARCH_BOTH,
  SARAH_SEARCH_BROKER,
  SARAH_SEARCH_SKIP,
  SEARCH_HOMES_TOOL,
  applyHomeSearchTurn,
  assertFairHousingCopy,
  cleanHomeSearchParsed,
  homeSearchCaptureTags,
  homeSearchFlowAnswers,
  homeSearchSeeAllHref,
  looksLikeHomeSearch,
  parseHomeSearch,
  type HomeSearchAnswers,
  type HomeSearchCard,
  type HomeSearchCriteria,
  type HomeSearchState,
  type HomeSearchStep,
  type HomeSearchTurn,
} from './home-search-parse'

export type HomeSearchDeps = {
  search: (filter: SearchListingsAllFilter) => Promise<{ rows: ListingTile[]; totalCount: number }>
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export function homeSearchDalFilter(parsed: Record<string, string>): SearchListingsAllFilter {
  const cleaned = cleanHomeSearchParsed(parsed)
  const coerced = coerceRegistryParams(cleaned)
  return {
    status: 'active',
    city: cleaned.city || undefined,
    subdivision: cleaned.subdivision || undefined,
    postalCode: cleaned.postalCode && /^\d{5}$/.test(cleaned.postalCode) ? cleaned.postalCode : undefined,
    propertyType: cleaned.propertyType || undefined,
    keywords: cleaned.keywords && cleaned.keywords.length >= 2 ? cleaned.keywords : undefined,
    ...pickSearchFeatureFilters(coerced),
    priceMin: num(coerced.priceMin) ?? num(cleaned.minPrice),
    priceMax: num(coerced.priceMax) ?? num(cleaned.maxPrice),
    bedsMin: num(coerced.bedsMin) ?? num(cleaned.beds),
    bedsMax: num(coerced.bedsMax) ?? num(cleaned.maxBeds),
    bathsMin: num(coerced.bathsMin) ?? num(cleaned.baths),
    bathsMax: num(coerced.bathsMax) ?? num(cleaned.maxBaths),
    lotAcresMin: num(coerced.lotAcresMin) ?? num(cleaned.lotAcresMin),
    lotAcresMax: num(coerced.lotAcresMax) ?? num(cleaned.lotAcresMax),
    sqftMin: num(coerced.sqftMin) ?? num(cleaned.minSqFt),
    sqftMax: num(coerced.sqftMax) ?? num(cleaned.maxSqFt),
    garageMin: num(coerced.garageMin) ?? num(cleaned.garageMin),
    yearBuiltMin: num(coerced.yearBuiltMin) ?? num(cleaned.yearBuiltMin),
    yearBuiltMax: num(coerced.yearBuiltMax) ?? num(cleaned.yearBuiltMax),
    limit: HOME_SEARCH_CARD_MAX,
    sort: 'newest',
  }
}

export function cardFromTile(tile: ListingTile): HomeSearchCard | null {
  const href = listingTileHref({
    listingKey: tile.listingKey,
    listNumber: tile.listNumber,
    streetNumber: tile.streetNumber,
    streetName: tile.streetName,
    city: tile.city,
    subdivisionName: tile.subdivisionName,
  })
  if (!href || href === '/homes-for-sale') return null
  const address = publishCardAddress({
    streetNumber: tile.streetNumber,
    streetDirPrefix: tile.streetDirPrefix,
    streetName: tile.streetName,
    streetSuffix: tile.streetSuffix,
    streetDirSuffix: tile.streetDirSuffix,
    city: tile.city,
  })
  return {
    href,
    photoUrl: tile.photoUrl,
    price: tile.listPrice != null && Number.isFinite(tile.listPrice) ? formatPriceExact(tile.listPrice) : 'Price on request',
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    address: address || 'Address on request',
    city: tile.city,
    listNumber: tile.listNumber,
  }
}

async function defaultSearch(filter: SearchListingsAllFilter) {
  return searchListingsAll(filter)
}

export async function runHomeSearch(
  visitorText: string,
  deps?: HomeSearchDeps,
): Promise<HomeSearchTurn> {
  const parsed = parseHomeSearch(visitorText)
  const label = criteriaLabel(parsed)
  const followUp = followUpKind(parsed)
  const seeAllHref = homeSearchSeeAllHref(parsed)
  let rows: ListingTile[] = []
  let totalCount = 0
  try {
    const result = await (deps?.search ?? defaultSearch)(homeSearchDalFilter(parsed))
    rows = result.rows
    totalCount = result.totalCount
  } catch (err) {
    console.error('[runHomeSearch]', err)
  }
  const cards = rows.map(cardFromTile).filter((card): card is HomeSearchCard => Boolean(card))
  const shown = cards.length
  const copy = matchCopy(totalCount, shown, label)
  const reply = `${copy.reply} ${followUpAsk(followUp)}`
  assertFairHousingCopy(reply)
  assertFairHousingCopy(copy.voice)
  const seeAll =
    totalCount > 0
      ? { href: seeAllHref, label: `See all ${totalCount} ${homesWord(totalCount)}` }
      : { href: parsed.city ? homesForSalePath(parsed.city) : '/homes-for-sale', label: parsed.city ? `See homes in ${parsed.city}` : 'See homes for sale' }
  return {
    reply,
    voiceSummary: copy.voice,
    cards,
    seeAll,
    chips: null,
    capture: false,
    next: {
      step: 'followup',
      followUp,
      criteria: criteriaFromParsed(parsed),
      answers: {},
      totalCount,
      seeAllHref,
    },
  }
}
