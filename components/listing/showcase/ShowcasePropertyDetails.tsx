import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { H3 } from '@/components/site/primitives'

type Props = {
  listing: {
    property_type: string | null
    property_sub_type: string | null
    year_built: number | null
    levels: number | null
    living_area: number | null
    lot_size_acres: number | null
    lot_size_sqft: number | null
    garage_spaces: number | null
    architectural_style: string | null
    construction_materials: string | null
    roof: string | null
    flooring: string | null
    heating: string | null
    cooling: string | null
    fireplace_yn: boolean | null
    fireplace_features: string | null
    interior_features: string | null
    exterior_features: string | null
    kitchen_appliances: string | null
    pool_features: string | null
    view: string | null
    waterfront_yn: boolean | null
    water_source: string | null
    sewer: string | null
    association_yn: boolean | null
    association_fee: number | null
    association_fee_frequency: string | null
    elementary_school: string | null
    middle_school: string | null
    high_school: string | null
  }
  communityName: string | null
}

function row(label: string, value: string | number | boolean | null | undefined): { label: string; value: string } | null {
  if (value == null || value === '') return null
  const v = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)
  if (v === '' || v === 'No') return null
  return { label, value: v }
}

export default function ShowcasePropertyDetails({ listing, communityName }: Props) {
  const rows = [
    row('Property type', listing.property_type ?? listing.property_sub_type),
    row('Year built', listing.year_built),
    row('Levels', listing.levels),
    row('Living area', listing.living_area != null ? `${Number(listing.living_area).toLocaleString()} sqft` : null),
    row('Lot', listing.lot_size_acres != null && listing.lot_size_acres > 0 ? `${listing.lot_size_acres} acres` : listing.lot_size_sqft != null ? `${Number(listing.lot_size_sqft).toLocaleString()} sqft` : null),
    row('Garage', listing.garage_spaces),
    row('Style', listing.architectural_style),
    row('Construction', listing.construction_materials),
    row('Roof', listing.roof),
    row('Flooring', listing.flooring),
    row('Heating', listing.heating),
    row('Cooling', listing.cooling),
    row('Fireplace', listing.fireplace_yn ? (listing.fireplace_features || 'Yes') : null),
    row('Interior features', listing.interior_features),
    row('Exterior features', listing.exterior_features),
    row('Appliances', listing.kitchen_appliances),
    row('Pool', listing.pool_features),
    row('View', listing.view),
    row('Waterfront', listing.waterfront_yn ? 'Yes' : null),
    row('Water source', listing.water_source),
    row('Sewer', listing.sewer),
    row('HOA', listing.association_yn ? (listing.association_fee != null ? `$${listing.association_fee}/${listing.association_fee_frequency ?? 'mo'}` : 'Yes') : null),
    communityName ? { label: 'Community', value: communityName } : null,
    row('Elementary', listing.elementary_school),
    row('Middle school', listing.middle_school),
    row('High school', listing.high_school),
  ].filter((r): r is { label: string; value: string } => r != null)

  if (rows.length === 0) return null

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <H3 as="h2" className="text-lg text-foreground">Property details</H3>
        <Separator className="my-4" />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className={cn('text-sm text-foreground', value.length > 80 && 'whitespace-pre-wrap')}>{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
