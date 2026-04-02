import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { getPropertyTypeLabel } from '@/lib/property-type-labels'

function formatNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return Number(n).toLocaleString()
}

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type Fact = { label: string; value: string }

type Props = {
  beds: number | null
  baths: number | null
  sqft: number | null
  lotAcres: number | null
  lotSqft: number | null
  propertyType: string | null
  yearBuilt: number | null
  price: number | null
  daysOnMarket: number | null
  mlsNumber: string | null
}

export default function ShowcaseKeyFacts({
  beds,
  baths,
  sqft,
  lotAcres,
  lotSqft,
  propertyType,
  yearBuilt,
  price,
  daysOnMarket,
  mlsNumber,
}: Props) {
  const facts: Fact[] = [
    { label: 'Bedrooms', value: formatNum(beds) },
    { label: 'Bathrooms', value: formatNum(baths) },
    { label: 'Square feet', value: sqft != null && sqft > 0 ? formatNum(sqft) : '—' },
    { label: 'Lot', value: lotAcres != null && lotAcres > 0 ? `${lotAcres} acres` : lotSqft != null && lotSqft > 0 ? `${formatNum(lotSqft)} sqft` : '—' },
    { label: 'Type', value: getPropertyTypeLabel(propertyType) },
    { label: 'Year built', value: yearBuilt != null ? String(yearBuilt) : '—' },
    { label: 'List price', value: formatPrice(price) },
    { label: 'Days on market', value: daysOnMarket != null ? String(daysOnMarket) : '—' },
    { label: 'MLS number', value: mlsNumber?.trim() || '—' },
  ].filter((f) => f.value !== '—' || f.label === 'MLS number')

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Key facts</h2>
        <Separator className="my-4" />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {facts.map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className={cn('text-sm font-medium text-foreground', value === '—' && 'text-muted-foreground')}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
