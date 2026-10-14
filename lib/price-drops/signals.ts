/**
 * Factual deal signals on a price-cut home. No guesses about a seller's
 * circumstances. Remarks text never leaves this module: callers get a
 * matched phrase or a boolean.
 */

export const OWNER_WILL_CARRY_TERMS = ['Owner Will Carry', 'Assumable'] as const

export const BANK_OWNED_CONDITIONS = [
  'Real Estate Owned',
  'HUD Owned',
  'In Foreclosure',
  'Short Sale',
] as const

/**
 * Public-remarks seller-credit phrases, longest first. A match returns this
 * phrase, never the surrounding remarks.
 */
export const SELLER_CREDIT_PHRASES = [
  'seller concession',
  'seller credit',
  'closing cost credit',
  'rate buy down',
  'rate buydown',
  'closing costs',
  'concession',
  'credit',
] as const

export type PriceDropSignalKind =
  | 'repeatCuts'
  | 'longDom'
  | 'ownerWillCarry'
  | 'sellerCredit'
  | 'bankOwned'

export const PRICE_DROP_SIGNAL_DEFINITIONS: Record<
  PriceDropSignalKind,
  { label: string; definition: string }
> = {
  repeatCuts: {
    label: 'Repeat cuts',
    definition:
      'The asking price has been reduced at least twice since this listing was entered on the MLS.',
  },
  longDom: {
    label: 'Long days on market',
    definition:
      'Active days on market are more than twice this city\'s median days to an offer (last 90 days).',
  },
  ownerWillCarry: {
    label: 'Owner will carry',
    definition:
      'The MLS Listing Terms field includes Owner Will Carry or Assumable. That is a financing term on the listing, not a read of the seller.',
  },
  sellerCredit: {
    label: 'Seller credit or concession',
    definition:
      'The public remarks name a seller credit, concession, rate buydown, or closing-cost help. The page shows the matched phrase only.',
  },
  bankOwned: {
    label: 'Bank-owned or short sale',
    definition:
      'The MLS Special Listing Conditions field is Real Estate Owned, HUD Owned, In Foreclosure, or Short Sale.',
  },
}

function norm(value: string): string {
  return value.trim().toLowerCase()
}

function listHas(values: readonly string[] | null | undefined, wanted: readonly string[]): boolean {
  if (!values?.length) return false
  const set = new Set(values.map(norm))
  return wanted.some((item) => set.has(norm(item)))
}

export function hasOwnerWillCarry(listingTerms: readonly string[] | null | undefined): boolean {
  return listHas(listingTerms, OWNER_WILL_CARRY_TERMS)
}

export function hasBankOwnedOrShortSale(
  specialConditions: readonly string[] | null | undefined,
): boolean {
  return listHas(specialConditions, BANK_OWNED_CONDITIONS)
}

/**
 * First matching public-remarks phrase. Never returns remarks text.
 * Callers must not pass agent-only remarks here.
 */
export function sellerCreditPhrase(publicRemarks: string | null | undefined): string | null {
  if (!publicRemarks?.trim()) return null
  const hay = publicRemarks.toLowerCase()
  for (const phrase of SELLER_CREDIT_PHRASES) {
    if (hay.includes(phrase)) return phrase
  }
  return null
}

export function isRepeatCut(cutCount: number | null | undefined): boolean {
  return cutCount != null && Number.isFinite(cutCount) && cutCount >= 2
}

export function longDomThreshold(medianDaysToOffer: number | null | undefined): number | null {
  if (medianDaysToOffer == null || !Number.isFinite(medianDaysToOffer) || medianDaysToOffer <= 0) {
    return null
  }
  return medianDaysToOffer * 2
}

export function isLongDom(
  dom: number | null | undefined,
  medianDaysToOffer: number | null | undefined,
): boolean {
  const threshold = longDomThreshold(medianDaysToOffer)
  if (threshold == null) return false
  return dom != null && Number.isFinite(dom) && dom > threshold
}

export type PriceDropSignalFlags = {
  repeatCuts: boolean
  longDom: boolean
  ownerWillCarry: boolean
  sellerCredit: boolean
  bankOwned: boolean
}

export function priceDropSignalFlags(input: {
  cutCount?: number | null
  dom?: number | null
  medianDaysToOffer?: number | null
  listingTerms?: readonly string[] | null
  sellerCreditPhrase?: string | null
  specialConditions?: readonly string[] | null
  remarksEnabled?: boolean
  reoEnabled?: boolean
}): PriceDropSignalFlags {
  return {
    repeatCuts: isRepeatCut(input.cutCount),
    longDom: isLongDom(input.dom, input.medianDaysToOffer),
    ownerWillCarry: hasOwnerWillCarry(input.listingTerms),
    sellerCredit: Boolean(input.remarksEnabled && input.sellerCreditPhrase),
    bankOwned: Boolean(input.reoEnabled && hasBankOwnedOrShortSale(input.specialConditions)),
  }
}
