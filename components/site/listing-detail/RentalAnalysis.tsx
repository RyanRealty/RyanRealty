import RentalCalculator from '@/components/tools/RentalCalculator'
import { Body, Eyebrow, H2, Stack } from '@/components/site/primitives'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * Listing-detail rental-analysis embed. Pre-fills the long-term-rental
 * calculator from THIS property (price, taxes, address) plus an estimated rent,
 * so a visitor can instantly see whether the home pencils as a buy-and-hold
 * rental — monthly cash flow, cap rate, cash-on-cash, total cash needed, and a
 * 30-year projection.
 *
 * Estimates only (CLAUDE.md §0): the rent figure is a labeled estimate shown
 * with a range; every input is editable. The calculator carries its own
 * "estimates, not investment advice" disclaimer.
 *
 * Mirrors the MortgageCalculator embed: a server-safe section wrapper that takes
 * the already-fetched ListingDetail (no second fetch) and renders the client
 * calculator island.
 */

/** Annual property-tax fallback when the listing carries no tax figure. ~0.75%
 *  of price is a reasonable Central Oregon effective rate. */
const TAX_FALLBACK_PCT = 0.0075

/**
 * Rough monthly gross-rent estimate from price. Central Oregon SFR gross rent
 * runs near ~0.5% of value per month; this is a conservative starting point the
 * visitor edits, NOT a comp-backed figure. A real estimate comes from RentCast
 * (lib/rentcast.ts / getRentEstimate) once a rent source is wired; until then
 * this keeps the embed useful and is clearly surfaced as an estimate + range.
 */
function estimateMonthlyRent(price: number): { value: number; low: number; high: number } {
  const mid = Math.max(500, Math.round((price * 0.005) / 25) * 25)
  return { value: mid, low: Math.round((mid * 0.85) / 25) * 25, high: Math.round((mid * 1.15) / 25) * 25 }
}

/** MLS PropertyType codes that make sense for a long-term rental analysis
 *  (Residential A, Condo/Townhome B, Manufactured C). Land (D) + commercial
 *  (E-H) are skipped. Also tolerates label strings just in case. */
function isRentalEligible(propertyType: string | null): boolean {
  if (!propertyType) return true // unknown -> show (a sale listing is residential by default)
  const t = propertyType.trim().toUpperCase()
  if (['A', 'B', 'C'].includes(t)) return true
  if (['D', 'E', 'F', 'G', 'H'].includes(t)) return false
  const lower = propertyType.toLowerCase()
  return !(lower.includes('land') || lower.includes('lot') || lower.includes('commercial') || lower.includes('acreage'))
}

export function RentalAnalysis({ listing }: { listing: ListingDetail }) {
  const price = listing.listPrice ?? 0
  if (!price || price <= 0) return null
  if (!isRentalEligible(listing.propertyType)) return null

  const taxes =
    listing.taxAnnualAmount && listing.taxAnnualAmount > 0
      ? listing.taxAnnualAmount
      : Math.round(price * TAX_FALLBACK_PCT)
  const label = [listing.streetNumber, listing.streetName].filter(Boolean).join(' ').trim() || undefined
  const rent = estimateMonthlyRent(price)

  return (
    <Stack gap="default">
      <div>
        <Eyebrow>For investors</Eyebrow>
        <H2 className="mt-1.5">Could this be a rental?</H2>
        <Body size="small" tone="muted" className="mt-1.5">
          See the monthly cash flow, cap rate, and cash-on-cash return at this price. Every number is an
          estimate you can adjust to your own financing and rent.
        </Body>
      </div>
      <RentalCalculator
        embedded
        initialPrice={price}
        initialPropertyTaxesYear={taxes}
        propertyLabel={label}
        rentEstimate={{ value: rent.value, low: rent.low, high: rent.high, source: 'estimate' }}
      />
    </Stack>
  )
}
