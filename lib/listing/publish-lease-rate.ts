/**
 * The published rent on a commercial lease, or null. Pure.
 *
 * WHAT THE FIELD IS. On MLS PropertyType 'G' ("Commercial Lease" in the feed's
 * own label) `ListPrice` is rent, not a sale price, and rent is a number with a
 * unit: $1.40 is a monthly rate per square foot, $2,500 is a monthly amount for
 * the whole space. The unit is not in any RESO field. `LeaseAmountFrequency`,
 * `RentOrLeasePriceFrequency` and `LeaseAmount` are NULL on every G row read for
 * this (2026-09-23). The unit rides in the raw payload, `listings.details`, under
 * the key "Lease Rate Options" (with spaces). The feed's own metadata
 * (data/search-metadata/spark-metadata.snapshot.json, `cf:Lease Rate Options`)
 * lists exactly four values, and those four are the only ones this module reads:
 *   "$ Amt/Mo"  a monthly amount for the space
 *   "$ Amt/Yr"  a yearly amount for the space
 *   "$/SF/Mo"   a monthly rate per square foot
 *   "$/SF/Yr"   a yearly rate per square foot
 * Verified rows, 2026-09-23: ListingKey 20260514121750306188000000 (Bend,
 * Center Addition to Bend) ListPrice 1.4 "$/SF/Mo"; 20260216185852526641000000
 * (Klamath Falls) 2500 "$ Amt/Mo"; 20260603003252829675000000 (Grants Pass) 5000
 * "$ Amt/Mo".
 *
 * NEVER A BARE NUMBER (CLAUDE.md section 0). "$1.40" alone is not a fact about a
 * lease; neither is "$2,500". A rate whose unit is missing, or is not one of the
 * four, publishes nothing and the card says LEASE_RATE_NOT_PUBLISHED.
 *
 * A UNIT THAT CONTRADICTS ITS OWN NUMBER PUBLISHES NOTHING. The broad count,
 * every on-market G row (listing_tile_mv property_type 'G', Active / Active
 * Under Contract / Pending, then the unit by ListingKey from `listings`),
 * 2026-09-23: 239 rows. $/SF/Mo 171, $ Amt/Mo 43, $/SF/Yr 4, $ Amt/Yr 2, no unit
 * 19. Every per-square-foot value is at most $36 and every whole-space amount is
 * at least $325, EXCEPT six rows, and nothing on the whole feed falls between
 * $36 and $325. Those six are the unit filed wrong, and the rows say so:
 *   65315 Highway 97, Bend, MLS 220226579: 3000 "$/SF/Mo" on 4,500 sq ft ("Can
 *     be leased as a whole or divided into 1,500 SF bays"). $3,000 a square foot
 *     a month would be $13.5 million a month.
 *   5598 Table Rock, Medford, MLS 220211740: 1.1 "$ Amt/Mo" for "This 1,500 SF
 *     warehouse space ... in addition to a $150/month CAM charge". A $1.10 rent
 *     under a $150 CAM is a per-square-foot rate.
 *   6011 Grinde, Silverton, 15570 and 7000 "$/SF/Mo"; 3628 Pacific, Phoenix,
 *     2160 "$/SF/Mo" on 2,700 sq ft; 707 5th, Klamath Falls, 3000 "$/SF/Yr" on
 *     10,250 sq ft.
 * So LEASE_UNIT_BREAK sits at $100, inside that empty band: a per-square-foot
 * rate at or above it, or a whole-space amount under it, is withheld. It
 * withholds none of the 214 rows whose unit and number agree. Re-count the band
 * before moving it; a row inside it is a reason to look, not to widen.
 */
import { listingPriceIsLeaseRate } from './publish-listing-figure'

/** The four values the feed's metadata lists for "Lease Rate Options". */
export const LEASE_RATE_OPTIONS = ['$ Amt/Mo', '$ Amt/Yr', '$/SF/Mo', '$/SF/Yr'] as const
export type LeaseRateOption = (typeof LEASE_RATE_OPTIONS)[number]

/** The raw-payload key the unit lives under in `listings.details`. */
export const LEASE_RATE_DETAILS_KEY = 'Lease Rate Options'

/** What a lease card prints where a price goes when the rate cannot publish. */
export const LEASE_RATE_NOT_PUBLISHED = 'Lease rate not published'

/** The label a lease carries in place of a sale status. */
export const LEASE_LABEL = 'For lease'

/**
 * The line between a per-square-foot rate and a whole-space amount, in dollars.
 * See the header: nothing on the feed falls between $36 and $325.
 */
export const LEASE_UNIT_BREAK = 100

type LeaseUnit = { basis: 'space' | 'sqft'; period: 'month' | 'year' }

const UNIT_BY_OPTION: Readonly<Record<LeaseRateOption, LeaseUnit>> = {
  '$ Amt/Mo': { basis: 'space', period: 'month' },
  '$ Amt/Yr': { basis: 'space', period: 'year' },
  '$/SF/Mo': { basis: 'sqft', period: 'month' },
  '$/SF/Yr': { basis: 'sqft', period: 'year' },
}

function squash(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const OPTION_BY_KEY: ReadonlyMap<string, LeaseRateOption> = new Map(
  LEASE_RATE_OPTIONS.map((option) => [squash(option), option]),
)

/**
 * One of the four feed values, or null. Tolerates case and spacing, never a
 * fifth value: an unknown unit is an unknown unit.
 */
export function leaseRateOption(raw: unknown): LeaseRateOption | null {
  if (typeof raw !== 'string') return null
  return OPTION_BY_KEY.get(squash(raw)) ?? null
}

function money(value: number, basis: LeaseUnit['basis']): string {
  // A per-square-foot rate keeps its cents ($1.40, $18.00) and any finer digit
  // the feed carries ($1.375), so the published rate is the listed rate. A
  // whole-space amount prints whole dollars unless the feed carries cents.
  const digits =
    basis === 'sqft'
      ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
      : Number.isInteger(value)
        ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        : { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  return `$${value.toLocaleString('en-US', digits)}`
}

export type LeaseRateInput = {
  /** The row's ListPrice. On a lease this is the rent. */
  listPrice: number | null | undefined
  /** The row's "Lease Rate Options" value, verbatim. */
  rateOption: string | null | undefined
}

/** 'long' reads in a sentence; 'compact' fits a card's price slot. */
export type LeaseRateRegister = 'long' | 'compact'

/**
 * The rent with its unit, or null.
 *
 *   long     "$1.40 per sq ft per month" · "$2,500 per month"
 *   compact  "$1.40/sq ft/mo"            · "$2,500/mo"
 *
 * Null for: no price, a price that is not positive, a unit that is missing or
 * not one of the four, a unit its own number contradicts (LEASE_UNIT_BREAK), and
 * any figure whose printed form would be zero dollars.
 */
export function publishLeaseRate(
  input: LeaseRateInput,
  register: LeaseRateRegister = 'long',
): string | null {
  const value = input.listPrice
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const option = leaseRateOption(input.rateOption)
  if (!option) return null
  const unit = UNIT_BY_OPTION[option]
  if (unit.basis === 'sqft' && value >= LEASE_UNIT_BREAK) return null
  if (unit.basis === 'space' && value < LEASE_UNIT_BREAK) return null
  const amount = money(value, unit.basis)
  if (/^\$0(?:\.0+)?$/.test(amount)) return null
  if (register === 'compact') {
    const per = unit.period === 'month' ? 'mo' : 'yr'
    return unit.basis === 'sqft' ? `${amount}/sq ft/${per}` : `${amount}/${per}`
  }
  const per = unit.period === 'month' ? 'per month' : 'per year'
  return unit.basis === 'sqft' ? `${amount} per sq ft ${per}` : `${amount} ${per}`
}

export type ListingLeaseFigure = {
  /** The published rate, or null when it cannot publish. */
  rate: string | null
  /** What prints where a price goes: the rate, or LEASE_RATE_NOT_PUBLISHED. */
  text: string
  /** Always LEASE_LABEL: a lease is labelled, never given a sale status. */
  label: typeof LEASE_LABEL
}

/**
 * The lease half of a listing's price slot. Null when the listing is not a
 * commercial lease, so a sale listing's card is untouched; otherwise the rate
 * (or the withheld line) and the label, decided in one place for every card.
 */
export function publishListingLeaseFigure(
  input: {
    price: number | null | undefined
    propertyType: string | null | undefined
    leaseRateOption?: string | null
  },
  register: LeaseRateRegister = 'compact',
): ListingLeaseFigure | null {
  if (!listingPriceIsLeaseRate(input.propertyType)) return null
  const rate = publishLeaseRate(
    { listPrice: input.price, rateOption: input.leaseRateOption ?? null },
    register,
  )
  return { rate, text: rate ?? LEASE_RATE_NOT_PUBLISHED, label: LEASE_LABEL }
}
