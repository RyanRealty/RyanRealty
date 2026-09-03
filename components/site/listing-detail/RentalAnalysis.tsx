import RentalCalculator from '@/components/tools/RentalCalculator'
import type { ListingDetail } from '@/lib/data/types/listing'
import { getAreaRentEstimate } from '@/lib/hud-fmr'
import { PROPERTY_TAX_RATE_FRACTION } from '@/lib/property-tax-rate'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { publishRentalHoaMonthly } from '@/lib/listing/publish-listing-hoa'
import { publishWholePropertyAmount } from '@/lib/listing/publish-listing-figure'

/**
 * Listing-detail RentalAnalysis — the section wrapper around the calculator.
 * Navy sec-head, Amboqia heading. RentalCalculator interactive island preserved.
 *
 * The lede was `Body` from components/site/primitives — a third register on a
 * page that already carries two. It is the calculator's own muted line now
 * (2026-09-02, with the calculator's move off shadcn).
 *
 * Per CLAUDE.md §0 Data Accuracy: all numbers are labeled estimates.
 *
 * THE PRICE THIS SECTION NEEDS IS THE WHOLE HOME'S. Every other input it feeds
 * the engine describes the whole dwelling — the HUD area rent for its bed
 * count, its tax bill, its HOA — so a price that buys a share of it returns the
 * yield of nothing. MLS 220190868 (a $1 fractional interest at Eagle Crest)
 * published "At $1 with 20% down, this property cash-flows $1,310 per month, a
 * 1571464.0% cap rate and 0.0% cash-on-cash return" beside "Cash needed $0";
 * MLS 220225983 (a $3,000 fractional at Inn of the 7th Mountain) published a
 * 225.2% cap rate and a 1,094.0% cash-on-cash return. MLS 220222478 (a $159,900
 * quarter share of an 866 sq ft cabin at Lake Creek Lodge, which the feed files
 * under sub type "Condominium") published "Cap rate 3.5%", "Cash on cash
 * -14.3%", "Cash needed $31,980", "Cash flow -$382/mo" and "Gross rent $1,602"
 * — the HUD three-bedroom rent for the WHOLE cabin against a quarter-share
 * price. publishWholePropertyAmount withholds all three, and §0.7 makes the
 * withheld case a rendered nothing.
 */

function estimateMonthlyRent(price: number): { value: number; low: number; high: number; source: string } {
  const mid = Math.max(500, Math.round((price * 0.005) / 25) * 25)
  return {
    value: mid,
    low: Math.round((mid * 0.85) / 25) * 25,
    high: Math.round((mid * 1.15) / 25) * 25,
    source: 'starting estimate',
  }
}

function isRentalEligible(propertyType: string | null): boolean {
  if (!propertyType) return true
  const t = propertyType.trim().toUpperCase()
  if (['A', 'B', 'C'].includes(t)) return true
  if (['D', 'E', 'F', 'G', 'H'].includes(t)) return false
  const lower = propertyType.toLowerCase()
  return !(lower.includes('land') || lower.includes('lot') || lower.includes('commercial') || lower.includes('acreage'))
}

export function RentalAnalysis({ listing }: { listing: ListingDetail }) {
  const price = publishWholePropertyAmount({
    price: listing.listPrice,
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  })
  if (price == null) return null
  if (!isRentalEligible(listing.propertyType)) return null
  // design-audit: a HUD apartment Fair Market Rent applied to a multi-million
  // estate produces an absurd headline cash flow (e.g. -$63,117/mo on an $11.9M
  // home) that dents data credibility on the tier where buyers scrutinize numbers
  // most. Above this threshold a property is virtually never evaluated as a
  // HUD-rent rental, so suppress the module rather than seed a wrong number.
  const LUXURY_RENTAL_SUPPRESS = 2_000_000
  if (price > LUXURY_RENTAL_SUPPRESS) return null

  // EVERY FIGURE IN THIS SECTION DESCENDS FROM A MONTHLY RENT, AND A RENT NEEDS
  // A DWELLING. HUD prices by bedroom count, so a row stating none has no input
  // for the sourced path, and falling through to the price-ratio estimate only
  // swaps one unsourced rent for another: on MLS 220218536 it reads $500/mo off
  // a $19,500 share. §0.7 — render nothing.
  //
  // THE POPULATION SPANS ALL THREE ELIGIBLE CLASSES, not class A alone
  // (re-counted 2026-08-19). Live Active or Active Under Contract rows stating
  // no BedroomsTotal: 46 of 4,685 'A', 5 of 228 'B', and 155 of 155 'C' — the
  // feed never files a bedroom count on multi-family. 193 of those are in this
  // section's render window (43 'A', 5 'B', 145 'C') and lose it here; 57 of the
  // 193 are in a HUD-mapped city and were the ones publishing a fabricated
  // sourced label. See the lib/hud-fmr.ts docblock for the counts and the
  // rendered page each was verified on.
  if (listing.beds == null) return null

  const taxes =
    listing.taxAnnualAmount && listing.taxAnnualAmount > 0
      ? listing.taxAnnualAmount
      : Math.round(price * PROPERTY_TAX_RATE_FRACTION)
  const label = publishStreetLine({
    streetNumber: listing.streetNumber,
    streetDirPrefix: listing.streetDirPrefix,
    streetName: listing.streetName,
    streetSuffix: listing.streetSuffix,
    streetDirSuffix: listing.streetDirSuffix,
  }) || undefined
  const hud = getAreaRentEstimate(listing.city, listing.beds)
  const rent = hud
    ? { value: hud.value, low: hud.low, high: hud.high, source: hud.label }
    : estimateMonthlyRent(price)
  const hoaMonthly = publishRentalHoaMonthly({
    hoaMonthly: listing.hoaMonthly,
    associationFee: listing.associationFee,
    associationFeeFrequency: listing.associationFeeFrequency,
  })

  return (
    <section>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">For investors</div>
          <h2 className="sec-title">Rental analysis</h2>
        </div>
      </div>

      <div className="rental-analysis__body">
        <p className="rc__note">
          Monthly cash flow, cap rate, and cash-on-cash return at this price. Adjust the
          numbers to your own financing and rent.
        </p>
        <RentalCalculator
          embedded
          initialPrice={price}
          initialPropertyTaxesYear={taxes}
          // Same 20% / 7% defaults as Monthly payment. Down dollars come from
          // publishFinancingSplit so the two widgets cannot disagree.
          initialDownPaymentPct={20}
          initialInterestRate={7}
          initialHoaMonthly={hoaMonthly}
          propertyLabel={label}
          rentEstimate={{ value: rent.value, low: rent.low, high: rent.high, source: rent.source }}
        />
      </div>
    </section>
  )
}
