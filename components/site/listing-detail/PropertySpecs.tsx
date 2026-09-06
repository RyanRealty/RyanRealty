import type { ReactNode } from 'react'
import { Price, TabularNumber } from '@/components/site/primitives'
import type { ListingDetail } from '@/lib/data/types/listing'
import { publishListingHoa } from '@/lib/listing/publish-listing-hoa'
import { publishListingSharePricePerSqft } from '@/lib/listing/publish-listing-share'
import { propertySubTypeDisplayLabel } from '@/lib/property-type'
import { cn } from '@/lib/utils'

/**
 * Facts on the house page: type, lot, year, HOA if any, $/sqft.
 * Same house-row language as search (middle dots, only leftover values).
 */

type Props = {
  listing: Pick<
    ListingDetail,
    | 'propertyType'
    | 'propertySubType'
    | 'subdivisionName'
    | 'city'
    | 'listNumber'
    | 'lotSizeAcres'
    | 'lotSizeSqft'
    | 'yearBuilt'
    | 'hoaMonthly'
    | 'associationFee'
    | 'associationFeeFrequency'
    | 'pricePerSqft'
  >
  className?: string
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  A: 'Residential',
  B: 'Manufactured in park',
  C: 'Residential income',
  D: 'Lots and land',
  E: 'Farm',
  F: 'Commercial sale',
  G: 'Commercial lease',
  H: 'Business opportunity',
}

function propertyTypeLabel(code: string | null | undefined): string | null {
  if (!code) return null
  if (code.length <= 2) return PROPERTY_TYPE_LABELS[code.toUpperCase()] ?? null
  return code
}

function num(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

export function PropertySpecs({ listing, className }: Props) {
  const subType = listing.propertySubType?.trim()
  const typeLabel =
    (subType && !subType.startsWith('*') ? propertySubTypeDisplayLabel(subType) : null) ||
    propertyTypeLabel(listing.propertyType)

  const parts: ReactNode[] = []
  if (typeLabel) parts.push(typeLabel)
  if (num(listing.lotSizeAcres)) {
    parts.push(
      <>
        <TabularNumber value={listing.lotSizeAcres} fractionDigits={2} /> acres
      </>,
    )
  } else if (num(listing.lotSizeSqft)) {
    parts.push(
      <>
        <TabularNumber value={listing.lotSizeSqft} /> sqft lot
      </>,
    )
  }
  if (num(listing.yearBuilt)) {
    parts.push(<>Built {listing.yearBuilt}</>)
  }
  const hoa = publishListingHoa({
    hoaMonthly: listing.hoaMonthly,
    associationFee: listing.associationFee,
    associationFeeFrequency: listing.associationFeeFrequency,
  })
  if (hoa) {
    parts.push(
      <>
        HOA <Price value={hoa.monthly} exact />/mo
      </>,
    )
  }
  const ppsf = publishListingSharePricePerSqft({
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
    pricePerSqft: listing.pricePerSqft,
  })
  if (num(ppsf)) {
    parts.push(
      <>
        <Price value={ppsf} exact />/sqft
      </>,
    )
  }

  if (parts.length === 0) return null

  return (
    <section id="specs" className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <h2 className="sec-title">Facts</h2>
        </div>
      </div>
      <p className="listing-facts-row">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 ? ' · ' : null}
            {part}
          </span>
        ))}
      </p>
    </section>
  )
}
