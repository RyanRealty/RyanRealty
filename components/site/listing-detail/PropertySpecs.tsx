import {
  Price,
  TabularNumber,
} from '@/components/site/primitives'
import type { ListingDetail } from '@/lib/data/types/listing'
import { cn } from '@/lib/utils'

/**
 * Listing-detail PropertySpecs — the full key-facts surface in KB section
 * style. Navy border sec-head, Amboqia sec-title, mono labels + tabular
 * values, grouped into labeled sub-blocks (Overview, Interior, Exterior & lot,
 * Systems & utilities, Financial, Listing).
 *
 * Per CLAUDE.md §0 Data Accuracy: every value renders through Price /
 * TabularNumber / a checked literal. A cell is only emitted when the field has
 * a real value — null / empty / false never produces a row, so the UI never
 * shows "null", a blank cell, or a fabricated figure. We render only what's in
 * the data.
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
    | 'hoaMonthly'
    | 'associationFee'
    | 'associationFeeFrequency'
    | 'taxAnnualAmount'
    | 'taxAssessedValue'
    | 'taxYear'
    | 'listNumber'
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
    | 'listDate'
    | 'cumulativeDaysOnMarket'
    | 'schoolDistrict'
    | 'elementarySchool'
    | 'middleSchool'
    | 'highSchool'
  >
  className?: string
}

type Spec = {
  label: string
  value: React.ReactNode
}

type Group = {
  label: string
  specs: Spec[]
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  A: 'Residential',
  B: 'Condo or townhome',
  C: 'Manufactured home',
  D: 'Lots and land',
  E: 'Multi-family',
  F: 'Farm or ranch',
  G: 'Commercial',
  H: 'Other',
}

function propertyTypeLabel(code: string | null | undefined): string | null {
  if (!code) return null
  if (code.length <= 2) return PROPERTY_TYPE_LABELS[code.toUpperCase()] ?? null
  return code
}

/** True only for a finite, positive number — the gate for "render this cell". */
function num(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

/** True only for a non-empty, non-sentinel string. */
function txt(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0 && !v.startsWith('***')
}

function frequencyLabel(freq: string | null | undefined): string {
  if (!txt(freq)) return ''
  const f = freq.toLowerCase()
  if (f.startsWith('month')) return 'per month'
  if (f.startsWith('annual') || f.startsWith('year')) return 'per year'
  if (f.startsWith('quarter')) return 'per quarter'
  if (f.startsWith('semi')) return 'twice a year'
  return `per ${freq.toLowerCase()}`
}

function buildGroups(listing: Props['listing']): Group[] {
  const groups: Group[] = []

  const sqft = listing.sqft ?? listing.totalLivingAreaSqFt ?? null
  const subType = txt(listing.propertySubType) ? listing.propertySubType : null
  const ptypeLabel = propertyTypeLabel(subType) ?? propertyTypeLabel(listing.propertyType)

  // ── Overview ──────────────────────────────────────────────────────────────
  const overview: Spec[] = []
  if (num(listing.beds)) overview.push({ label: 'Bedrooms', value: <TabularNumber value={listing.beds} /> })
  if (num(listing.baths))
    overview.push({ label: 'Bathrooms', value: <TabularNumber value={listing.baths} fractionDigits={1} /> })
  if (num(sqft))
    overview.push({ label: 'Living area', value: <><TabularNumber value={sqft} /> sq ft</> })
  if (ptypeLabel) overview.push({ label: 'Property type', value: ptypeLabel })
  if (num(listing.yearBuilt))
    overview.push({ label: 'Year built', value: <span className="tabular-nums">{listing.yearBuilt}</span> })
  if (num(listing.propertyAge))
    overview.push({ label: 'Property age', value: <><TabularNumber value={listing.propertyAge} /> years</> })
  if (txt(listing.architecturalStyle)) overview.push({ label: 'Style', value: listing.architecturalStyle })
  if (listing.newConstructionYn) overview.push({ label: 'New construction', value: 'Yes' })
  if (listing.propertyAttachedYn) overview.push({ label: 'Attached', value: 'Yes' })
  if (overview.length > 0) groups.push({ label: 'Overview', specs: overview })

  // ── Interior ────────────────────────────────────────────────────────────────
  const interior: Spec[] = []
  if (num(listing.roomsTotal))
    interior.push({ label: 'Total rooms', value: <TabularNumber value={listing.roomsTotal} /> })
  if (num(listing.storiesTotal))
    interior.push({ label: 'Stories', value: <TabularNumber value={listing.storiesTotal} /> })
  if (txt(listing.levels)) interior.push({ label: 'Levels', value: listing.levels })
  if (num(listing.buildingAreaTotal))
    interior.push({ label: 'Building area', value: <><TabularNumber value={listing.buildingAreaTotal} /> sq ft</> })
  if (num(listing.fireplacesTotal))
    interior.push({ label: 'Fireplaces', value: <TabularNumber value={listing.fireplacesTotal} /> })
  else if (listing.fireplaceYn) interior.push({ label: 'Fireplace', value: 'Yes' })
  if (listing.basementYn) interior.push({ label: 'Basement', value: 'Yes' })
  if (interior.length > 0) groups.push({ label: 'Interior', specs: interior })

  // ── Exterior & lot ────────────────────────────────────────────────────────
  const exterior: Spec[] = []
  if (num(listing.lotSizeAcres))
    exterior.push({ label: 'Lot size', value: <><TabularNumber value={listing.lotSizeAcres} fractionDigits={2} /> acres</> })
  else if (num(listing.lotSizeSqft))
    exterior.push({ label: 'Lot size', value: <><TabularNumber value={listing.lotSizeSqft} /> sq ft</> })
  if (txt(listing.lotFeatures)) exterior.push({ label: 'Lot features', value: listing.lotFeatures })
  if (txt(listing.viewDescription)) exterior.push({ label: 'View', value: listing.viewDescription })
  if (txt(listing.directionFaces)) exterior.push({ label: 'Faces', value: listing.directionFaces })
  if (txt(listing.fencing)) exterior.push({ label: 'Fencing', value: listing.fencing })
  if (txt(listing.constructionMaterials))
    exterior.push({ label: 'Construction', value: listing.constructionMaterials })
  if (txt(listing.roof)) exterior.push({ label: 'Roof', value: listing.roof })
  if (txt(listing.foundationDetails)) exterior.push({ label: 'Foundation', value: listing.foundationDetails })
  if (listing.waterfrontYn) exterior.push({ label: 'Waterfront', value: 'Yes' })
  if (listing.poolYn) exterior.push({ label: 'Pool', value: 'Yes' })
  if (listing.spaYn) exterior.push({ label: 'Spa', value: 'Yes' })
  // Parking lives with the lot.
  if (num(listing.garageSpaces))
    exterior.push({ label: 'Garage', value: <><TabularNumber value={listing.garageSpaces} /> spaces</> })
  else if (listing.garageYn) exterior.push({ label: 'Garage', value: 'Yes' })
  if (num(listing.carportSpaces))
    exterior.push({ label: 'Carport', value: <><TabularNumber value={listing.carportSpaces} /> spaces</> })
  if (num(listing.parkingTotal))
    exterior.push({ label: 'Total parking', value: <><TabularNumber value={listing.parkingTotal} /> spaces</> })
  if (exterior.length > 0) groups.push({ label: 'Exterior & lot', specs: exterior })

  // ── Systems & utilities ─────────────────────────────────────────────────────
  const systems: Spec[] = []
  if (listing.heatingYn) systems.push({ label: 'Heating', value: 'Yes' })
  if (listing.coolingYn) systems.push({ label: 'Cooling', value: 'Yes' })
  if (txt(listing.water)) systems.push({ label: 'Water', value: listing.water })
  if (txt(listing.sewer)) systems.push({ label: 'Sewer', value: listing.sewer })
  if (systems.length > 0) groups.push({ label: 'Systems & utilities', specs: systems })

  // ── Financial ───────────────────────────────────────────────────────────────
  const financial: Spec[] = []
  if (num(listing.pricePerSqft))
    financial.push({ label: 'Price / sq ft', value: <Price value={listing.pricePerSqft} /> })
  if (num(listing.closePricePerSqft))
    financial.push({ label: 'Sold / sq ft', value: <Price value={listing.closePricePerSqft} /> })
  if (num(listing.saleToListRatio))
    financial.push({
      label: 'Sale to list',
      value: <span className="tabular-nums">{(listing.saleToListRatio * 100).toFixed(1)}%</span>,
    })
  if (num(listing.hoaMonthly))
    financial.push({ label: 'HOA', value: <><Price value={listing.hoaMonthly} /> per month</> })
  else if (num(listing.associationFee))
    financial.push({
      label: 'HOA',
      value: (
        <>
          <Price value={listing.associationFee} /> {frequencyLabel(listing.associationFeeFrequency)}
        </>
      ),
    })
  if (num(listing.taxAnnualAmount))
    financial.push({ label: 'Annual taxes', value: <Price value={listing.taxAnnualAmount} /> })
  if (num(listing.taxAssessedValue))
    financial.push({ label: 'Assessed value', value: <Price value={listing.taxAssessedValue} /> })
  if (num(listing.taxYear))
    financial.push({ label: 'Tax year', value: <span className="tabular-nums">{listing.taxYear}</span> })
  if (financial.length > 0) groups.push({ label: 'Financial', specs: financial })

  // ── Listing ─────────────────────────────────────────────────────────────────
  const listingInfo: Spec[] = []
  if (txt(listing.listNumber))
    listingInfo.push({ label: 'MLS number', value: <span className="tabular-nums">{listing.listNumber}</span> })
  if (txt(listing.county)) listingInfo.push({ label: 'County', value: listing.county })
  if (txt(listing.parcelNumber)) listingInfo.push({ label: 'Parcel', value: listing.parcelNumber })
  if (num(listing.walkScore))
    listingInfo.push({ label: 'Walk score', value: <span className="tabular-nums">{listing.walkScore}</span> })
  if (num(listing.cumulativeDaysOnMarket))
    listingInfo.push({
      label: 'Days on market',
      value: <><TabularNumber value={listing.cumulativeDaysOnMarket} /> days</>,
    })
  if (txt(listing.schoolDistrict)) listingInfo.push({ label: 'School district', value: listing.schoolDistrict })
  if (txt(listing.elementarySchool)) listingInfo.push({ label: 'Elementary', value: listing.elementarySchool })
  if (txt(listing.middleSchool)) listingInfo.push({ label: 'Middle', value: listing.middleSchool })
  if (txt(listing.highSchool)) listingInfo.push({ label: 'High', value: listing.highSchool })
  if (listingInfo.length > 0) groups.push({ label: 'Listing', specs: listingInfo })

  return groups
}

function SpecGrid({ specs }: { specs: Spec[] }) {
  return (
    <dl
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1px',
        background: '#102742',
        border: '1px solid #102742',
      }}
    >
      {specs.map((spec) => (
        <div
          key={spec.label}
          style={{
            background: 'var(--cream, #faf8f4)',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <dt
            className="mono-lab"
            style={{
              fontSize: '0.6rem',
              fontWeight: 600,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(16,39,66,0.55)',
            }}
          >
            {spec.label}
          </dt>
          <dd
            style={{
              fontSize: 'clamp(1rem,1.8vw,1.15rem)',
              fontWeight: 600,
              color: 'var(--navy, #102742)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {spec.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function PropertySpecs({ listing, className }: Props) {
  const groups = buildGroups(listing)
  if (groups.length === 0) return null

  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Facts</div>
          <h2 className="sec-title display">Property details</h2>
        </div>
      </div>

      <div
        style={{
          marginTop: 'clamp(22px,3vw,36px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(22px,2.6vw,32px)',
        }}
      >
        {groups.map((group) => (
          <div key={group.label}>
            <div
              className="mono-lab"
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--navy, #102742)',
                paddingBottom: 10,
                marginBottom: 12,
                borderBottom: '1px solid #102742',
              }}
            >
              {group.label}
            </div>
            <SpecGrid specs={group.specs} />
          </div>
        ))}
      </div>
    </section>
  )
}
