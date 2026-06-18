import {
  Price,
  TabularNumber,
} from '@/components/site/primitives'
import type { ListingDetail } from '@/lib/data/types/listing'
import { cn } from '@/lib/utils'

/**
 * Listing-detail PropertySpecs — key facts grid in KB section style.
 * Navy border sec-head, Amboqia sec-title, mono labels + tabular values.
 *
 * Per CLAUDE.md §0 Data Accuracy: every value is rendered through
 * Price / TabularNumber / em-dash fallback.
 */

type Props = {
  listing: Pick<
    ListingDetail,
    | 'beds'
    | 'baths'
    | 'sqft'
    | 'totalLivingAreaSqFt'
    | 'lotSizeAcres'
    | 'yearBuilt'
    | 'propertyType'
    | 'propertySubType'
    | 'hoaMonthly'
    | 'taxAnnualAmount'
    | 'taxAssessedValue'
    | 'listNumber'
    | 'garageSpaces'
    | 'fireplaceYn'
    | 'waterfrontYn'
    | 'architecturalStyle'
    | 'newConstructionYn'
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

function buildSpecs(listing: Props['listing']): Spec[] {
  const sqft = listing.sqft ?? listing.totalLivingAreaSqFt ?? null
  const subType =
    listing.propertySubType && !listing.propertySubType.startsWith('***')
      ? listing.propertySubType
      : null
  const ptypeLabel = propertyTypeLabel(subType) ?? propertyTypeLabel(listing.propertyType)
  const out: Spec[] = [
    { label: 'Bedrooms', value: <TabularNumber value={listing.beds} /> },
    { label: 'Bathrooms', value: <TabularNumber value={listing.baths} fractionDigits={1} /> },
    { label: 'Living area', value: sqft ? <><TabularNumber value={sqft} /> sq ft</> : '—' },
    {
      label: 'Lot size',
      value: listing.lotSizeAcres ? <><TabularNumber value={listing.lotSizeAcres} fractionDigits={2} /> acres</> : '—',
    },
    { label: 'Year built', value: listing.yearBuilt ? <span className="tabular-nums">{listing.yearBuilt}</span> : '—' },
    { label: 'Property type', value: ptypeLabel ?? '—' },
    { label: 'Garage', value: listing.garageSpaces ? <><TabularNumber value={listing.garageSpaces} /> spaces</> : '—' },
    {
      label: 'HOA',
      value: listing.hoaMonthly ? <><Price value={listing.hoaMonthly} /> per month</> : '—',
    },
    {
      label: 'Annual taxes',
      value: listing.taxAnnualAmount ? <Price value={listing.taxAnnualAmount} /> : '—',
    },
    {
      label: 'MLS number',
      value: listing.listNumber ? <span className="tabular-nums">{listing.listNumber}</span> : '—',
    },
  ]
  if (listing.architecturalStyle && !listing.architecturalStyle.startsWith('***')) {
    out.push({ label: 'Style', value: listing.architecturalStyle })
  }
  if (listing.schoolDistrict && !listing.schoolDistrict.startsWith('***')) {
    out.push({ label: 'School district', value: listing.schoolDistrict })
  }
  return out
}

export function PropertySpecs({ listing, className }: Props) {
  const specs = buildSpecs(listing)
  const badges: string[] = []
  if (listing.newConstructionYn) badges.push('New construction')
  if (listing.fireplaceYn) badges.push('Fireplace')
  if (listing.waterfrontYn) badges.push('Waterfront')

  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Facts</div>
          <h2 className="sec-title display">Property details</h2>
        </div>
      </div>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1px',
          background: 'rgba(16,39,66,0.12)',
          border: '1px solid rgba(16,39,66,0.12)',
          marginTop: 'clamp(22px,3vw,36px)',
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
              className="mono-num"
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

      {badges.length > 0 ? (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {badges.map((b) => (
            <span
              key={b}
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--navy, #102742)',
                border: '1px solid rgba(16,39,66,0.28)',
                padding: '5px 12px',
              }}
            >
              {b}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}
