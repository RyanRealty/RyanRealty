import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import MiniSparkline from '@/components/reports/MiniSparkline'
import type { ListingDetailPriceHistory } from '@/app/actions/listing-detail'
import { H3 } from '@/components/site/primitives'

type Props = {
  priceHistory: ListingDetailPriceHistory[]
}

function formatPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function PriceHistoryChart({ priceHistory }: Props) {
  if (priceHistory.length === 0) return null

  const points = [...priceHistory]
    .sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
    .map((entry) => Number(entry.new_price ?? entry.old_price ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0)

  return (
    <Card>
      <CardContent className="p-6">
        <H3 as="h2" className="text-lg text-foreground">Price history trend</H3>
        <Separator className="my-4" />
        <MiniSparkline values={points} className="h-12 w-full text-primary" />
        <div className="mt-4 space-y-2">
          {priceHistory.slice(0, 5).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(entry.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              <span className="font-medium text-foreground">
                {formatPrice(entry.old_price)} {' -> '} {formatPrice(entry.new_price)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
