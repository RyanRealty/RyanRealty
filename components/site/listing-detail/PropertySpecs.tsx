import type { ReactNode } from 'react'
import { Price, TabularNumber } from '@/components/site/primitives'
import type { ListingDetail } from '@/lib/data/types/listing'
import { publishListingHoa } from '@/lib/listing/publish-listing-hoa'
import { publishListingSharePricePerSqft } from '@/lib/listing/publish-listing-share'
import { propertySubTypeDisplayLabel } from '@/lib/property-type'
import { cn } from '@/lib/utils'

/**
 * Facts on the house page — every non-empty ListingDetail field the page
 * already has (SITE-115). Same v3 tokens as the rest of the house URL.
 * Null / empty / false never produce a row. Do not invent.
 */

type Props = {
  listing: Pick<
    ListingDetail,
    | 'beds'
    | 'baths'
    | 'sqft'
    | 'totalLivingAreaSqFt'
    | 'lotSizeAcres'
    | 'lotSizeSqft'
    | 'yearBuilt'
    | 'propertyAge'
    | 'propertyType'
    | 'propertySubType'
    | 'subdivisionName'
    | 'city'
    | 'listNumber'
    | 'hoaMonthly'
    | 'associationFee'
    | 'associationFeeFrequency'
    | 'taxAnnualAmount'
    | 'taxAssessedValue'
    | 'taxYear'
    | 'garageSpaces'
    | 'garageYn'
    | 'carportSpaces'
    | 'parkingTotal'
    | 'fireplaceYn'
    | 'fireplacesTotal'
    | 'waterfrontYn'
    | 'poolYn'
    | 'spaYn'
    | 'architecturalStyle'
    | 'newConstructionYn'
    | 'propertyAttachedYn'
    | 'storiesTotal'
    | 'levels'
    | 'roomsTotal'
    | 'basementYn'
    | 'buildingAreaTotal'
    | 'heatingYn'
    | 'coolingYn'
    | 'roof'
    | 'constructionMaterials'
    | 'foundationDetails'
    | 'lotFeatures'
    | 'fencing'
    | 'directionFaces'
    | 'viewDescription'
    | 'sewer'
    | 'water'
    | 'county'
    | 'parcelNumber'
    | 'walkScore'
    | 'pricePerSqft'
    | 'closePricePerSqft'
    | 'saleToListRatio'
    | 'cumulativeDaysOnMarket'
    | 'schoolDistrict'
  >
  className?: string
}

type Spec = {
  label: string
  value: ReactNode
}

type Group = {
  label: string
  specs: Spec[]
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

function txt(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0 && !v.startsWith('***')
}

function buildGroups(listing: Props['listing']): Group[] {
  const groups: Group[] = []
  const sqft = listing.sqft ?? listing.totalLivingAreaSqFt ?? null
  const subType = listing.propertySubType?.trim()
  const typeLabel =
    (subType && !subType.startsWith('*') ? propertySubTypeDisplayLabel(subType) : null) ||
    propertyTypeLabel(listing.propertyType)

  const overview: Spec[] = []
  if (num(listing.beds)) overview.push({ label: 'Bedrooms', value: <TabularNumber value={listing.beds} /> })
  if (num(listing.baths)) {
    overview.push({
      label: 'Bathrooms',
      value: (
        <TabularNumber
          value={listing.baths}
          fractionDigits={Number.isInteger(listing.baths) ? 0 : 1}
        />
      ),
    })
  }
  if (num(sqft)) {
    overview.push({
      label: 'Living area',
      value: (
        <>
          <TabularNumber value={sqft} /> sqft
        </>
      ),
    })
  }
  if (typeLabel) overview.push({ label: 'Property type', value: typeLabel })
  if (num(listing.yearBuilt)) overview.push({ label: 'Year built', value: listing.yearBuilt })
  if (num(listing.propertyAge)) {
    overview.push({
      label: 'Property age',
      value: (
        <>
          <TabularNumber value={listing.propertyAge} /> years
        </>
      ),
    })
  }
  if (txt(listing.architecturalStyle)) overview.push({ label: 'Style', value: listing.architecturalStyle })
  if (listing.newConstructionYn) overview.push({ label: 'New construction', value: 'Yes' })
  if (listing.propertyAttachedYn) overview.push({ label: 'Attached', value: 'Yes' })
  if (overview.length > 0) groups.push({ label: 'Overview', specs: overview })

  const interior: Spec[] = []
  if (num(listing.roomsTotal)) {
    interior.push({ label: 'Total rooms', value: <TabularNumber value={listing.roomsTotal} /> })
  }
  if (num(listing.storiesTotal)) {
    interior.push({ label: 'Stories', value: <TabularNumber value={listing.storiesTotal} /> })
  }
  if (txt(listing.levels)) interior.push({ label: 'Levels', value: listing.levels })
  if (num(listing.buildingAreaTotal)) {
    interior.push({
      label: 'Building area',
      value: (
        <>
          <TabularNumber value={listing.buildingAreaTotal} /> sqft
        </>
      ),
    })
  }
  if (num(listing.fireplacesTotal)) {
    interior.push({ label: 'Fireplaces', value: <TabularNumber value={listing.fireplacesTotal} /> })
  } else if (listing.fireplaceYn) {
    interior.push({ label: 'Fireplace', value: 'Yes' })
  }
  if (listing.basementYn) interior.push({ label: 'Basement', value: 'Yes' })
  if (listing.heatingYn) interior.push({ label: 'Heating', value: 'Yes' })
  if (listing.coolingYn) interior.push({ label: 'Cooling', value: 'Yes' })
  if (interior.length > 0) groups.push({ label: 'Interior', specs: interior })

  const exterior: Spec[] = []
  if (num(listing.lotSizeAcres)) {
    exterior.push({
      label: 'Lot size',
      value: (
        <>
          <TabularNumber value={listing.lotSizeAcres} fractionDigits={2} /> acres
        </>
      ),
    })
  } else if (num(listing.lotSizeSqft)) {
    exterior.push({
      label: 'Lot size',
      value: (
        <>
          <TabularNumber value={listing.lotSizeSqft} /> sqft
        </>
      ),
    })
  }
  if (txt(listing.lotFeatures)) exterior.push({ label: 'Lot features', value: listing.lotFeatures })
  if (txt(listing.viewDescription)) exterior.push({ label: 'View', value: listing.viewDescription })
  if (txt(listing.directionFaces)) exterior.push({ label: 'Faces', value: listing.directionFaces })
  if (txt(listing.fencing)) exterior.push({ label: 'Fencing', value: listing.fencing })
  if (txt(listing.constructionMaterials)) {
    exterior.push({ label: 'Construction', value: listing.constructionMaterials })
  }
  if (txt(listing.roof)) exterior.push({ label: 'Roof', value: listing.roof })
  if (txt(listing.foundationDetails)) {
    exterior.push({ label: 'Foundation', value: listing.foundationDetails })
  }
  if (listing.waterfrontYn) exterior.push({ label: 'Waterfront', value: 'Yes' })
  if (listing.poolYn) exterior.push({ label: 'Pool', value: 'Yes' })
  if (listing.spaYn) exterior.push({ label: 'Spa', value: 'Yes' })
  if (num(listing.garageSpaces)) {
    exterior.push({
      label: 'Garage',
      value: (
        <>
          <TabularNumber value={listing.garageSpaces} /> spaces
        </>
      ),
    })
  } else if (listing.garageYn) {
    exterior.push({ label: 'Garage', value: 'Yes' })
  }
  if (num(listing.carportSpaces)) {
    exterior.push({
      label: 'Carport',
      value: (
        <>
          <TabularNumber value={listing.carportSpaces} /> spaces
        </>
      ),
    })
  }
  if (num(listing.parkingTotal)) {
    exterior.push({
      label: 'Total parking',
      value: (
        <>
          <TabularNumber value={listing.parkingTotal} /> spaces
        </>
      ),
    })
  }
  if (exterior.length > 0) groups.push({ label: 'Exterior & lot', specs: exterior })

  const systems: Spec[] = []
  if (txt(listing.water)) systems.push({ label: 'Water', value: listing.water })
  if (txt(listing.sewer)) systems.push({ label: 'Sewer', value: listing.sewer })
  if (systems.length > 0) groups.push({ label: 'Systems & utilities', specs: systems })

  const financial: Spec[] = []
  const ppsfSubject = {
    propertyType: listing.propertyType,
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  }
  const ppsf = publishListingSharePricePerSqft({
    ...ppsfSubject,
    pricePerSqft: listing.pricePerSqft,
  })
  const closePpsf = publishListingSharePricePerSqft({
    ...ppsfSubject,
    pricePerSqft: listing.closePricePerSqft,
  })
  if (num(ppsf)) financial.push({ label: 'Price / sqft', value: <Price value={ppsf} exact /> })
  if (num(closePpsf)) {
    financial.push({ label: 'Sold / sqft', value: <Price value={closePpsf} exact /> })
  }
  if (num(listing.saleToListRatio)) {
    financial.push({
      label: 'Sale to list',
      value: <span className="tabular-nums">{(listing.saleToListRatio * 100).toFixed(1)}%</span>,
    })
  }
  const hoa = publishListingHoa({
    hoaMonthly: listing.hoaMonthly,
    associationFee: listing.associationFee,
    associationFeeFrequency: listing.associationFeeFrequency,
  })
  if (hoa) {
    financial.push({
      label: 'HOA',
      value: (
        <>
          <Price value={hoa.monthly} exact />/mo
        </>
      ),
    })
  }
  if (num(listing.taxAnnualAmount)) {
    financial.push({ label: 'Annual taxes', value: <Price value={listing.taxAnnualAmount} exact /> })
  }
  if (num(listing.taxAssessedValue)) {
    financial.push({ label: 'Assessed value', value: <Price value={listing.taxAssessedValue} exact /> })
  }
  if (num(listing.taxYear)) financial.push({ label: 'Tax year', value: listing.taxYear })
  if (financial.length > 0) groups.push({ label: 'Financial', specs: financial })

  const listingInfo: Spec[] = []
  if (txt(listing.listNumber)) {
    listingInfo.push({ label: 'MLS number', value: <span className="tabular-nums">{listing.listNumber}</span> })
  }
  if (txt(listing.county)) listingInfo.push({ label: 'County', value: listing.county })
  if (txt(listing.parcelNumber)) listingInfo.push({ label: 'Parcel', value: listing.parcelNumber })
  if (num(listing.walkScore)) {
    listingInfo.push({ label: 'Walk score', value: <span className="tabular-nums">{listing.walkScore}</span> })
  }
  if (num(listing.cumulativeDaysOnMarket)) {
    listingInfo.push({
      label: 'Days on market',
      value: (
        <>
          <TabularNumber value={listing.cumulativeDaysOnMarket} /> days
        </>
      ),
    })
  }
  if (txt(listing.schoolDistrict)) {
    listingInfo.push({ label: 'School district', value: listing.schoolDistrict })
  }
  if (listingInfo.length > 0) groups.push({ label: 'Listing', specs: listingInfo })

  return groups
}

export function PropertySpecs({ listing, className }: Props) {
  const groups = buildGroups(listing)
  if (groups.length === 0) return null

  return (
    <section id="specs" className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <h2 className="sec-title">Facts</h2>
        </div>
      </div>
      <div className="listing-facts">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="listing-spec-group">{group.label}</p>
            <dl className="listing-spec-grid">
              {group.specs.map((spec) => (
                <div key={spec.label} className="listing-spec-row">
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}
