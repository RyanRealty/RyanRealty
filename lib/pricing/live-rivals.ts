/**
 * Live actives that would have passed the same pricing rungs.
 * Closed sales set the number. This only names who is for sale now
 * inside that search. It does not re-price.
 */

import { resolveMarketArea } from '@/lib/cma/market-area'
import {
  classifyHoa,
  classifyLot,
  classifyProduct,
  classifySewer,
  classifyStory,
  classifyWater,
  citySlug,
  normSubdivision,
} from '@/lib/pricing/classes'
import { pricingTierLadder, type PricingTier } from '@/lib/pricing/ladder'
import {
  passesPricingTier,
  type PricingSale,
  type PricingSubject,
  type SubdivisionCell,
} from '@/lib/pricing/match'
import { describeCompSearch } from '@/lib/pricing/search-story'

export type LiveListingInput = {
  listingKey: string
  address: string
  city: string
  subdivision?: string | null
  latitude?: number | null
  longitude?: number | null
  beds?: number | null
  baths?: number | null
  sqft: number
  listPrice: number
  lotAcres?: number | null
  yearBuilt?: number | null
  levels?: unknown
  propertySubType?: string | null
  water?: unknown
  sewer?: unknown
  associationYn?: boolean | null
  associationFee?: number | null
  newConstruction?: boolean | null
}

export function liveListingToSale(row: LiveListingInput): PricingSale {
  const lat = row.latitude ?? null
  const lng = row.longitude ?? null
  return {
    listingKey: row.listingKey,
    listNumber: null,
    address: row.address,
    city: row.city,
    citySlug: citySlug(row.city),
    subdivision: row.subdivision ?? null,
    subdivisionNorm: normSubdivision(row.subdivision),
    latitude: lat,
    longitude: lng,
    beds: row.beds ?? null,
    baths: row.baths ?? null,
    sqft: row.sqft,
    lotAcres: row.lotAcres ?? null,
    yearBuilt: row.yearBuilt ?? null,
    storyClass: classifyStory(row.levels, null),
    productClass: classifyProduct(row.propertySubType),
    waterClass: classifyWater(row.water),
    sewerClass: classifySewer(row.sewer),
    hoaClass: classifyHoa(row.associationYn ?? null, row.associationFee ?? null),
    lotClass: classifyLot(row.lotAcres),
    closePrice: row.listPrice,
    closeDate: '1970-01-01',
    concessionsAmount: null,
    concessionsYn: null,
    originalAsk: row.listPrice,
    lastAsk: row.listPrice,
    daysToOffer: null,
    cdom: null,
    dropCount: 0,
    closePpsf: row.sqft > 0 ? row.listPrice / row.sqft : 0,
    photoUrl: null,
    publicRemarks: null,
    marketArea: resolveMarketArea(lat, lng),
    newConstruction: row.newConstruction ?? null,
  }
}

export function tiersFromUsedNames(tiersUsed: readonly string[]): PricingTier[] {
  const byName = new Map(pricingTierLadder().map((t) => [t.name, t]))
  return tiersUsed.map((name) => byName.get(name)).filter((t): t is PricingTier => t != null)
}

export function livePassesUsedRungs(
  subject: PricingSubject,
  sale: PricingSale,
  tiers: readonly PricingTier[],
  asOf: string,
  cells: Map<string, SubdivisionCell>,
): boolean {
  if (tiers.length === 0) return false
  return tiers.some((tier) => passesPricingTier(subject, sale, tier, asOf, cells, { ignoreCloseTiming: true }).ok)
}

export function liveRivalSearchLabel(
  subdivision: string | null | undefined,
  tiersUsed: readonly string[],
): string {
  const story = describeCompSearch({ subdivision, tiersUsed })
  if (story.stayedInSubdivision && story.subdivisionName) {
    return `same ${story.subdivisionName} search as the sales that set the number`
  }
  if (story.radiusMiles != null) {
    return `same ${story.radiusMiles}-mile search as the sales that set the number`
  }
  return 'same search as the sales that set the number'
}
