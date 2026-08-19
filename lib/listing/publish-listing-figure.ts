/**
 * The publish contract for a listing money figure. Pure, and deliberately
 * IMPORT-FREE so the mechanical gate (scripts/check-listing-figure-publish.mjs)
 * can transpile this one file and execute the contract itself rather than
 * pattern-match a comment.
 *
 * FOUNDING CASE (verified live 2026-08-19, dev render of the real page).
 * 735 Purcell Boulevard, Bend — MLS 220174840, ListingKey
 * 20231213164224139125000000 — is a sublease of a former bank building. Its
 * MLS PropertyType is 'G', which the feed's own PropertyTypeLabel spells
 * "Commercial Lease", and its ListPrice is 2.5: a lease rate per square foot,
 * not a sale price. /homes-for-sale/bend/735-purcell-220174840 published
 *   H1 "$3"  ·  price strip "$3"
 *   listing history "Back on market $0 / Price change $0 / Listed $0"
 *   mortgage estimate "Loan amount $2 · $1 down · 30 year term"
 *   JSON-LD SingleFamilyResidence with offers.price 2.5
 * Two independent defects sat on that one page, and both are classes:
 *
 *  1. A LEASE RATE PUBLISHED UNDER SALE LABELS. On PropertyType 'G' the
 *     ListPrice field carries rent, so every sale-shaped figure derived from
 *     it — the ask, price per square foot, the loan amount — is a category
 *     error, not a rounding error. Basis for the code (live listings table,
 *     2026-08-19): PropertyType 'G' is labelled "Commercial Lease" on 4,310
 *     rows and carries no label on 25; it is never labelled anything else.
 *     214 'G' rows are Active, 176 of them priced under $1,000.
 *
 *  2. A POSITIVE AMOUNT PRINTED AS $0. The money formatter rounded to the
 *     nearest thousand, so every value under $500 published as "$0" while
 *     claiming to be that value. 149 Active listings carry price_per_sqft
 *     exactly 0 (already withheld by the > 0 guard) and 6 more carry a value
 *     between 0.01 and 0.49 — those printed "$0 per square foot" beside an
 *     ask. Same rounding printed the three "$0" rows on the Purcell history.
 *
 * §0.7 governs the shape of both fixes: publish a figure that is verified, or
 * publish no figure. Neither rule invents a threshold — the lease rule reads
 * the feed's own property-type code, and the zero rule asks only whether the
 * text we are about to print is "$0" for an amount that is not zero. A number
 * whose published form is $0 is not a number; it is the absence of one wearing
 * a dollar sign.
 *
 * WHY NOT A "$40 PER SQUARE FOOT" FLOOR. The 262 Active listings under $40 per
 * square foot are not one population. 179 are commercial leases (rule 1). The
 * rest are real and correct: an in-park manufactured home in Grants Pass at
 * $8,500 over 784 sq ft is $10.84 per square foot, and a 73,720 sq ft
 * commercial building in Hines at $549,000 is $7.45. A blanket floor would
 * withhold verified figures, which §0 forbids as firmly as it forbids wrong
 * ones.
 */

/**
 * MLS PropertyType codes whose ListPrice is a lease rate rather than a sale
 * price. Read from the feed's own PropertyTypeLabel — see the docblock trace.
 */
export const LEASE_PRICE_PROPERTY_TYPES: ReadonlySet<string> = new Set(['G'])

/** True when this listing's ListPrice is rent, not an asking sale price. */
export function listingPriceIsLeaseRate(propertyType: string | null | undefined): boolean {
  const code = (propertyType ?? '').trim().toUpperCase()
  if (!code) return false
  return LEASE_PRICE_PROPERTY_TYPES.has(code)
}

/** The three registers the money primitive prints in. */
export type MoneyRegister = 'thousand' | 'exact' | 'compact'

function roundToThousand(n: number): number {
  return Math.round(n / 1000) * 1000
}

function renderMoney(value: number, register: MoneyRegister): string {
  if (register === 'exact') {
    return `$${Math.round(value).toLocaleString('en-US')}`
  }
  if (register === 'compact') {
    if (value >= 1_000_000) {
      const m = value / 1_000_000
      return `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
    }
    if (value >= 1_000) {
      return `$${Math.round(value / 1000)}k`
    }
    return `$${Math.round(value)}`
  }
  return `$${roundToThousand(value).toLocaleString('en-US')}`
}

/**
 * The single money-text publisher. Returns null — never a string — when the
 * amount cannot be published in the requested register:
 *   · nothing to publish (null / NaN / not positive), or
 *   · the register would print "$0" for an amount that is not zero.
 *
 * The caller renders its own withheld placeholder. That is the whole rule; it
 * needs no threshold and no market knowledge.
 */
export function publishMoneyText(
  value: number | null | undefined,
  register: MoneyRegister = 'thousand',
): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const text = renderMoney(value, register)
  if (isZeroDollarText(text)) return null
  return text
}

/**
 * Whether a rendered money string publishes zero dollars. Kept exported so the
 * gate asserts the same predicate the runtime uses.
 */
export function isZeroDollarText(text: string): boolean {
  return /^\$0(?:\.0+)?(?:[kKmM])?$/.test(text.trim())
}

/**
 * The published price per square foot, or null.
 *
 * A lease rate is not a sale price per square foot, and a figure that prints
 * as "$0" is not a figure. Everything else passes through at the whole-dollar
 * precision the surfaces print.
 */
export function publishPricePerSqft(input: {
  propertyType: string | null | undefined
  pricePerSqft: number | null | undefined
}): number | null {
  if (listingPriceIsLeaseRate(input.propertyType)) return null
  const raw = input.pricePerSqft
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  const published = Math.round(raw)
  if (published <= 0) return null
  return published
}

/**
 * The published asking SALE price, or null. Withheld on a lease listing, where
 * the same field means rent.
 */
export function publishSaleAskAmount(input: {
  price: number | null | undefined
  propertyType: string | null | undefined
}): number | null {
  if (listingPriceIsLeaseRate(input.propertyType)) return null
  const raw = input.price
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  return Math.round(raw)
}
