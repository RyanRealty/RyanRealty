/**
 * Listing-detail "Quick facts" answer block (AEO).
 *
 * ChatGPT referrals land on listing URLs. The fold already prints price and a
 * beds/baths/sqft line; answer engines lift a sentence plus a definition list
 * near the top. Every value is one the page already has. A missing figure
 * drops its row and its clause. Nothing is estimated.
 *
 * JSON-LD (RealEstateListing / Residence / Offer) reads the same publisher so
 * the machine node cannot disagree with the visible block.
 */
import { daysLiveOnMarket, daysOnMarketToClose } from '@/lib/listing/days-live'
import { formatListingHoa, publishListingHoa } from '@/lib/listing/publish-listing-hoa'
import {
  listingPublishesClosePrice,
  publishListingStatusWord,
} from '@/lib/listing/publish-listing-published-price'
import { isPublicOffMarketStatus } from '@/lib/listing-status-public'
import { formatPriceExact } from '@/lib/format/money'
import { displaySubdivision } from '@/lib/slug'

export type ListingQuickFactRow = {
  term: string
  value: string
}

export type ListingQuickFactsInput = {
  street?: string | null
  city?: string | null
  /** Whole-property published price (ask, or close price when sold). */
  price?: number | null
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  lotSizeAcres?: number | null
  lotSizeSqft?: number | null
  yearBuilt?: number | null
  communityName?: string | null
  subdivisionName?: string | null
  status?: string | null
  onMarketDate?: string | null
  closeDate?: string | null
  hoaMonthly?: number | null
  associationFee?: number | null
  associationFeeFrequency?: string | null
  propertySubType?: string | null
  propertyType?: string | null
  now?: Date
}

export type ListingQuickFacts = {
  sentence: string
  rows: ListingQuickFactRow[]
  /** schema.org type for RealEstateListing.about. Null on land/commercial. */
  residenceType: 'Residence' | 'SingleFamilyResidence' | 'House' | 'Apartment' | null
}

function positive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

function wholeOrTenth(n: number): string {
  const tenths = Math.round(n * 10) / 10
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1)
}

function formatLot(acres: number | null | undefined, sqft: number | null | undefined): string | null {
  if (positive(acres)) {
    const rounded = Math.round(acres * 100) / 100
    return `${rounded} ${rounded === 1 ? 'acre' : 'acres'}`
  }
  if (positive(sqft)) return `${Math.round(sqft).toLocaleString('en-US')} sqft`
  return null
}

function communityLabel(communityName: string | null | undefined, subdivisionName: string | null | undefined): string | null {
  const named = communityName?.trim()
  if (named) return named
  return displaySubdivision(subdivisionName)
}

function statusLabel(status: string | null | undefined): string | null {
  const word = publishListingStatusWord(status)
  if (word) return word
  const raw = (status ?? '').trim()
  if (!raw) return null
  if (/coming\s*soon/i.test(raw)) return null
  return raw
}

function daysOnMarket(input: ListingQuickFactsInput): number | null {
  const now = input.now ?? new Date()
  if (listingPublishesClosePrice(input.status)) {
    return daysOnMarketToClose(input.onMarketDate, input.closeDate)
  }
  if (isPublicOffMarketStatus(input.status)) return null
  return daysLiveOnMarket(input.onMarketDate, now)
}

function daysLabel(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'day' : 'days'}`
}

/**
 * schema.org Residence subtype for a dwelling. Land, farm, and commercial
 * rows are not residences; the listing node still publishes, without `about`.
 */
export function listingResidenceType(
  propertySubType: string | null | undefined,
  propertyType: string | null | undefined,
): ListingQuickFacts['residenceType'] {
  const code = (propertyType ?? '').trim().toUpperCase()
  if (code === 'D' || code === 'E' || code === 'F' || code === 'G' || code === 'H') return null
  const sub = (propertySubType ?? '').trim()
  if (sub === 'Single Family Residence') return 'SingleFamilyResidence'
  if (sub === 'Condominium') return 'Apartment'
  if (sub === 'Townhouse') return 'House'
  return 'Residence'
}

function bedBathLead(beds: number | null | undefined, baths: number | null | undefined): string | null {
  const bedBit = positive(beds) ? `${wholeOrTenth(beds)}-bed` : null
  const bathBit = positive(baths) ? `${wholeOrTenth(baths)}-bath` : null
  if (bedBit && bathBit) return `${bedBit}, ${bathBit}`
  return bedBit ?? bathBit
}

export function publishListingQuickFacts(input: ListingQuickFactsInput): ListingQuickFacts | null {
  const rows: ListingQuickFactRow[] = []
  const price = positive(input.price) ? input.price : null
  const priceLabel = price != null ? formatPriceExact(price) : null
  const beds = positive(input.beds) ? input.beds : null
  const baths = positive(input.baths) ? input.baths : null
  const sqft = positive(input.sqft) ? Math.round(input.sqft) : null
  const lot = formatLot(input.lotSizeAcres, input.lotSizeSqft)
  const yearBuilt = positive(input.yearBuilt) ? Math.round(input.yearBuilt) : null
  const community = communityLabel(input.communityName, input.subdivisionName)
  const status = statusLabel(input.status)
  const days = daysOnMarket(input)
  const daysOk = days != null && Number.isFinite(days) && days >= 0
  const hoa = publishListingHoa({
    hoaMonthly: input.hoaMonthly,
    associationFee: input.associationFee,
    associationFeeFrequency: input.associationFeeFrequency,
  })
  const hoaLabel = hoa ? formatListingHoa(hoa) : null
  const sold = listingPublishesClosePrice(input.status)
  const offMarket = isPublicOffMarketStatus(input.status)

  if (priceLabel) rows.push({ term: sold ? 'Sold price' : 'Price', value: priceLabel })
  if (beds != null) rows.push({ term: 'Beds', value: wholeOrTenth(beds) })
  if (baths != null) rows.push({ term: 'Baths', value: wholeOrTenth(baths) })
  if (sqft != null) rows.push({ term: 'Living area', value: `${sqft.toLocaleString('en-US')} sqft` })
  if (lot) rows.push({ term: 'Lot', value: lot })
  if (yearBuilt != null) rows.push({ term: 'Year built', value: String(yearBuilt) })
  if (community) rows.push({ term: 'Community', value: community })
  if (status) rows.push({ term: 'Status', value: status })
  if (daysOk) rows.push({ term: 'Days on market', value: daysLabel(days) })
  if (hoaLabel) rows.push({ term: 'HOA', value: hoaLabel })

  if (rows.length === 0) return null

  const street = input.street?.trim() || null
  const city = input.city?.trim() || null
  const where = [street, city].filter(Boolean).join(' in ')
  const lead = bedBathLead(beds, baths)
  const subject = lead
    ? where
      ? `This ${lead} home at ${where}`
      : `This ${lead} home`
    : where
      ? where
      : 'This home'

  const sentences: string[] = []
  if (sold && priceLabel) sentences.push(`${subject} sold for ${priceLabel}.`)
  else if (offMarket && priceLabel) {
    sentences.push(`${subject} is off the market. The published price is ${priceLabel}.`)
  } else if (offMarket) sentences.push(`${subject} is off the market.`)
  else if (priceLabel) sentences.push(`${subject} is listed at ${priceLabel}.`)
  else sentences.push(`${subject}.`)

  const mid: string[] = []
  if (sqft != null) mid.push(`has ${sqft.toLocaleString('en-US')} square feet`)
  if (lot) mid.push(`sits on ${lot}`)
  if (yearBuilt != null) mid.push(`was built in ${yearBuilt}`)
  if (community) mid.push(`is in ${community}`)
  if (mid.length === 1) sentences.push(`It ${mid[0]}.`)
  else if (mid.length === 2) sentences.push(`It ${mid[0]} and ${mid[1]}.`)
  else if (mid.length > 2) {
    sentences.push(`It ${mid.slice(0, -1).join(', ')}, and ${mid[mid.length - 1]}.`)
  }

  const withBits: string[] = []
  if (daysOk) withBits.push(`${daysLabel(days)} on market`)
  if (hoaLabel) withBits.push(`HOA dues of ${hoaLabel}`)
  if (status && !sold && !offMarket) {
    if (withBits.length === 0) sentences.push(`Status is ${status}.`)
    else if (withBits.length === 1) sentences.push(`Status is ${status}, with ${withBits[0]}.`)
    else sentences.push(`Status is ${status}, with ${withBits[0]} and ${withBits[1]}.`)
  } else if (daysOk && hoaLabel) {
    const daysClause = sold || offMarket
      ? `It was on the market ${daysLabel(days)}`
      : `It has been on the market ${daysLabel(days)}`
    sentences.push(`${daysClause}, and HOA dues are ${hoaLabel}.`)
  } else if (daysOk) {
    sentences.push(
      sold || offMarket
        ? `It was on the market ${daysLabel(days)}.`
        : `It has been on the market ${daysLabel(days)}.`,
    )
  } else if (hoaLabel) {
    sentences.push(`HOA dues are ${hoaLabel}.`)
  }

  return {
    sentence: sentences.join(' ').replace(/\s+/g, ' ').trim(),
    rows,
    residenceType: listingResidenceType(input.propertySubType, input.propertyType),
  }
}
