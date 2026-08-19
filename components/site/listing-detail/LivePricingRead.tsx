import { cn } from '@/lib/utils'
import type { ListingPricingReadRow } from '@/lib/data/pricing/reads'
import { buildHouseMeRows, HouseMeReport } from './HouseMeReport'

type Props = {
  read: ListingPricingReadRow | null
  listPrice: number | null
  listingKey: string
  subjectAddress: string
  sqft?: number | null
  dom?: number | null
  placeMedianDays?: number | null
  placeName?: string | null
  hoaMonthly?: number | null
  associationFee?: number | null
  associationFeeFrequency?: string | null
  taxAnnualAmount?: number | null
  monthlyRent?: number | null
  propertySubType?: string | null
  /** MLS PropertyType code (A–H) — 'G' is a lease listing. */
  propertyType?: string | null
  hideCmaRequest?: boolean
  className?: string
}

export function LivePricingRead({
  read,
  listPrice,
  listingKey,
  subjectAddress,
  sqft = null,
  dom = null,
  placeMedianDays = null,
  placeName = null,
  hoaMonthly = null,
  associationFee = null,
  associationFeeFrequency = null,
  taxAnnualAmount = null,
  monthlyRent = null,
  propertySubType = null,
  propertyType = null,
  hideCmaRequest,
  className,
}: Props) {
  const facts = {
    read,
    listPrice,
    sqft,
    dom,
    placeMedianDays,
    placeName,
    hoaMonthly,
    associationFee,
    associationFeeFrequency,
    taxAnnualAmount,
    monthlyRent,
    propertySubType,
    propertyType,
  }
  if (buildHouseMeRows(facts).length === 0) return null
  return (
    <div className={cn(className)} data-testid="live-pricing-read">
      <HouseMeReport
        listingKey={listingKey}
        subjectAddress={subjectAddress}
        hideCmaRequest={hideCmaRequest}
        {...facts}
      />
    </div>
  )
}

export default LivePricingRead
