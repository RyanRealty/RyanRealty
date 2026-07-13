import RentalCalculator from '@/components/tools/RentalCalculator'
import { Body } from '@/components/site/primitives'
import type { ListingDetail } from '@/lib/data/types/listing'
import { getAreaRentEstimate } from '@/lib/hud-fmr'

/**
 * Listing-detail RentalAnalysis — KB section style.
 * Navy sec-head, Amboqia heading. RentalCalculator interactive island preserved.
 *
 * Per CLAUDE.md §0 Data Accuracy: all numbers are labeled estimates.
 */

const TAX_FALLBACK_PCT = 0.0075

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
  const price = listing.listPrice ?? 0
  if (!price || price <= 0) return null
  if (!isRentalEligible(listing.propertyType)) return null
  // design-audit: a HUD apartment Fair Market Rent applied to a multi-million
  // estate produces an absurd headline cash flow (e.g. -$63,117/mo on an $11.9M
  // home) that dents data credibility on the tier where buyers scrutinize numbers
  // most. Above this threshold a property is virtually never evaluated as a
  // HUD-rent rental, so suppress the module rather than seed a wrong number.
  const LUXURY_RENTAL_SUPPRESS = 2_000_000
  if (price > LUXURY_RENTAL_SUPPRESS) return null

  const taxes =
    listing.taxAnnualAmount && listing.taxAnnualAmount > 0
      ? listing.taxAnnualAmount
      : Math.round(price * TAX_FALLBACK_PCT)
  const label = [listing.streetNumber, listing.streetName, listing.streetSuffix].filter(Boolean).join(' ').trim() || undefined
  const hud = getAreaRentEstimate(listing.city, listing.beds)
  const rent = hud
    ? { value: hud.value, low: hud.low, high: hud.high, source: hud.label }
    : estimateMonthlyRent(price)

  return (
    <section>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">For investors</div>
          <h2 className="sec-title display">Rental analysis</h2>
        </div>
      </div>

      <div className="kb-tool-skin" style={{ marginTop: 'clamp(22px,3vw,36px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Body size="small" tone="muted">
          Monthly cash flow, cap rate, and cash-on-cash return at this price. Every number is an estimate you can adjust to your own financing and rent.
        </Body>
        <RentalCalculator
          embedded
          initialPrice={price}
          initialPropertyTaxesYear={taxes}
          // Match the Monthly-payment calculator's defaults (20% down, 7% rate)
          // so the two financing widgets on this page never disagree.
          initialDownPaymentPct={20}
          initialInterestRate={7}
          propertyLabel={label}
          rentEstimate={{ value: rent.value, low: rent.low, high: rent.high, source: rent.source }}
        />
      </div>
    </section>
  )
}
