import {
  Body,
  Eyebrow,
  Price,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'
import type { ListingDetail } from '@/lib/data/types/listing'
import { cn } from '@/lib/utils'

/**
 * Listing-detail PropertySpecs — the "facts" grid: beds, baths, square
 * footage, lot size, year built, property type, HOA, taxes, MLS number,
 * schools.
 *
 * Per CLAUDE.md §0 Data Accuracy + brand voice: every value is rendered
 * through Price / TabularNumber / em-dash fallback. Labels stay
 * sentence-case noun phrases (no marketing slop).
 *
 * Per plan §9 Layer 4.
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

// MLS PropertyType single-letter code → friendly label.
// Codes per docs/DATABASE_FOR_AI_AGENTS.md + verified against active
// PropertyType distribution in the listings table (8 codes A..H).
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
  // Single-letter MLS codes get mapped to a friendly label. Anything
  // else (multi-word PropertySubType strings from richer feeds) renders
  // as-is.
  if (code.length <= 2) return PROPERTY_TYPE_LABELS[code.toUpperCase()] ?? null
  return code
}

function buildSpecs(listing: Props['listing']): Spec[] {
  const sqft = listing.sqft ?? listing.totalLivingAreaSqFt ?? null
  // Prefer the richer PropertySubType when it's a real string; fall
  // back to the single-letter PropertyType code mapped to a friendly
  // label. Masked / placeholder values like "********" are filtered.
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

  return (
    <Stack gap="default" className={className}>
      <Eyebrow>Property facts</Eyebrow>
      <dl className="grid gap-x-8 gap-y-4 grid-cols-2 md:grid-cols-3">
        {specs.map((spec) => (
          <div key={spec.label}>
            <dt className="text-xs text-muted-foreground">{spec.label}</dt>
            <dd className="text-[15px] text-foreground font-semibold mt-0.5">{spec.value}</dd>
          </div>
        ))}
      </dl>
      {(listing.fireplaceYn || listing.waterfrontYn || listing.newConstructionYn) ? (
        <Body size="small" tone="muted" className={cn('flex flex-wrap gap-3 mt-2')}>
          {listing.newConstructionYn ? <span className="text-foreground">• New construction</span> : null}
          {listing.fireplaceYn ? <span className="text-foreground">• Fireplace</span> : null}
          {listing.waterfrontYn ? <span className="text-foreground">• Waterfront</span> : null}
        </Body>
      ) : null}
    </Stack>
  )
}
