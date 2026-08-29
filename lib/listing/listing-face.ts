/**
 * Listing template face. One family (listing-detail). House vs land
 * is a type branch on the same Stage + Sheet, not a second template.
 *
 * Land: MLS PropertyType D, a lot/land subtype, or a Residential Lots
 * row. Beds absence is supporting evidence, not the only switch.
 */

import { classifyInventoryPropertyType } from '@/lib/inventory-filters'
import { formatListingHoa, publishListingHoa } from '@/lib/listing/publish-listing-hoa'
import { formatPriceExact } from '@/lib/format/money'

export type ListingFace = 'house' | 'land'

export function isLandListingFace(input: {
  propertyType?: string | null
  propertySubType?: string | null
  beds?: number | null
}): boolean {
  const typeBucket = classifyInventoryPropertyType(input.propertyType)
  const subBucket = classifyInventoryPropertyType(input.propertySubType)
  if (typeBucket === 'land_lot' || subBucket === 'land_lot') return true

  const sub = (input.propertySubType ?? '').trim().toLowerCase()
  if (sub.includes('residential lot')) return true

  return false
}

export function listingFace(input: {
  propertyType?: string | null
  propertySubType?: string | null
  beds?: number | null
}): ListingFace {
  return isLandListingFace(input) ? 'land' : 'house'
}

export function publishLandAcres(acres: number | null | undefined): string | null {
  if (acres == null || !Number.isFinite(acres) || acres <= 0) return null
  const rounded = Math.round(acres * 100) / 100
  return `${rounded} acres`
}

export function publishLandPropertyTypeLabel(input: {
  propertyType?: string | null
  propertySubType?: string | null
}): string {
  const sub = (input.propertySubType ?? '').trim()
  if (/residential lots?/i.test(sub)) return 'Residential lot'
  if (classifyInventoryPropertyType(input.propertyType) === 'land_lot') return 'Residential lot'
  return 'Residential lot'
}

/**
 * One place name. Neighborhood and subdivision that spell the same
 * word (Awbrey Butte) collapse so the line does not stamp it twice.
 */
export function publishLandPlaceName(input: {
  neighborhood?: string | null
  subdivision?: string | null
}): string | null {
  const neighborhood = input.neighborhood?.trim() || null
  const subdivision =
    input.subdivision && input.subdivision !== 'N/A' ? input.subdivision.trim() : null
  if (neighborhood && subdivision) {
    if (neighborhood.toLowerCase() === subdivision.toLowerCase()) return neighborhood
    return neighborhood
  }
  return neighborhood ?? subdivision
}

/** Line two: 0.48 acres · Awbrey Butte · Bend */
export function publishLandLineTwo(input: {
  acres?: number | null
  neighborhood?: string | null
  subdivision?: string | null
  city?: string | null
}): string {
  return [publishLandAcres(input.acres), publishLandPlaceName(input), input.city?.trim() || null]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

export function publishLandTax(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null
  return `${formatPriceExact(amount)} / year`
}

export function publishLandHoa(input: {
  hoaMonthly?: number | null
  associationFee?: number | null
  associationFeeFrequency?: string | null
}): string | null {
  const hoa = publishListingHoa(input)
  return hoa ? formatListingHoa(hoa) : null
}

export function publishLandDom(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null
  return `${days} DOM`
}

export type LandFact = { label: string; value: string }

/** Facts first on the land Sheet: acres, type, DOM, taxes, HOA. */
export function publishLandFacts(input: {
  acres?: number | null
  propertyType?: string | null
  propertySubType?: string | null
  daysOnMarket?: number | null
  taxAnnualAmount?: number | null
  hoaMonthly?: number | null
  associationFee?: number | null
  associationFeeFrequency?: string | null
}): LandFact[] {
  const facts: LandFact[] = []
  const acres = publishLandAcres(input.acres)
  if (acres) facts.push({ label: 'Acres', value: acres })
  facts.push({
    label: 'Property type',
    value: publishLandPropertyTypeLabel(input),
  })
  const dom = publishLandDom(input.daysOnMarket)
  if (dom) facts.push({ label: 'DOM', value: dom })
  const taxes = publishLandTax(input.taxAnnualAmount)
  if (taxes) facts.push({ label: 'Taxes', value: taxes })
  const hoa = publishLandHoa(input)
  if (hoa) facts.push({ label: 'HOA', value: hoa })
  return facts
}

export function listingFaceNoun(face: ListingFace): 'lot' | 'home' {
  return face === 'land' ? 'lot' : 'home'
}
