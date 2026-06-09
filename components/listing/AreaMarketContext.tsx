import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { H3 } from '@/components/site/primitives'

type Props = {
  cityName: string | null
  listingPrice: number | null
  listingSqft: number | null
  medianAreaPrice: number | null
  medianAreaPpsf: number | null
  avgSaleToListRatio: number | null
  activeInventory: number | null
}

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export default function AreaMarketContext({
  cityName,
  listingPrice,
  listingSqft,
  medianAreaPrice,
  medianAreaPpsf,
  avgSaleToListRatio,
  activeInventory,
}: Props) {
  const listingPpsf = listingPrice != null && listingSqft != null && listingSqft > 0 ? listingPrice / listingSqft : null
  const premium =
    listingPrice != null && medianAreaPrice != null && medianAreaPrice > 0
      ? ((listingPrice - medianAreaPrice) / medianAreaPrice) * 100
      : null

  // Hide entire section when no area market data is available
  const hasAnyData = medianAreaPrice != null || medianAreaPpsf != null || avgSaleToListRatio != null || activeInventory != null
  if (!hasAnyData) return null

  return (
    <Card>
      <CardContent className="p-6">
        <H3 as="h2" className="text-lg text-foreground">
          Area market context{cityName ? ` in ${cityName}` : ''}
        </H3>
        <Separator className="my-4" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Metric label="Area median sale price" value={formatMoney(medianAreaPrice)} />
          <Metric label="Listing price" value={formatMoney(listingPrice)} />
          <Metric label="Area median price per sqft" value={medianAreaPpsf == null ? '—' : formatMoney(medianAreaPpsf)} />
          <Metric label="Listing price per sqft" value={listingPpsf == null ? '—' : formatMoney(listingPpsf)} />
          <Metric label="Average sale to list ratio" value={formatPercent(avgSaleToListRatio)} />
          <Metric label="Current active inventory" value={activeInventory == null ? '—' : activeInventory.toLocaleString()} />
        </div>
        {premium != null && (
          <p className="mt-4 text-sm text-muted-foreground">
            This listing is {premium >= 0 ? `${premium.toFixed(1)}% above` : `${Math.abs(premium).toFixed(1)}% below`} the area median price.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  )
}
