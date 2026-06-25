/**
 * OwnedHomeSummary — the "what they own" block on the record card. Renders a
 * clean spec line ("3 bed · 2 bath · 1,850 sqft · Awbrey Butte") and, only when
 * a real MLS close price is known, a "Paid $X in YYYY" line.
 *
 * Hard rule (brand voice / data accuracy): never show an estimated or invented
 * price. When pricePaid is null the price line is omitted entirely. The caller
 * supplies pricePaid strictly from real MLS close data.
 *
 * Presentational only. Spec/price formatting lives in source-labels.ts and is
 * unit-tested.
 */
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatPricePaid, formatInt, homeSpecFragments } from './source-labels'

export type OwnedHomeSummaryProps = {
  address: string
  beds: number | null
  baths: number | null
  sqft: number | null
  neighborhood: string | null
  /** Real MLS close price. Null when unknown — the price line is then omitted. */
  pricePaid: number | null
  pricePaidYear: number | null
  photoUrl?: string | null
  /** Present only when the owned home is currently on the market. */
  onMarket?: {
    status: string
    listPrice: number | null
    listingKey: string
  } | null
  className?: string
}

export default function OwnedHomeSummary({
  address,
  beds,
  baths,
  sqft,
  neighborhood,
  pricePaid,
  pricePaidYear,
  photoUrl,
  onMarket,
  className,
}: OwnedHomeSummaryProps) {
  const specs = homeSpecFragments({ beds, baths, sqft, neighborhood })
  const priceLabel = formatPricePaid(pricePaid)
  const showPaid = priceLabel != null && pricePaidYear != null
  const listLabel =
    onMarket && onMarket.listPrice != null && Number.isFinite(onMarket.listPrice)
      ? `$${formatInt(Math.round(onMarket.listPrice / 1000) * 1000)}`
      : null

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex gap-4 p-4">
        {photoUrl ? (
          <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
            <Image
              src={photoUrl}
              alt={address}
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{address}</p>
            {onMarket ? (
              <Badge
                variant="outline"
                className="shrink-0 border-success/40 bg-success/10 text-success"
              >
                {onMarket.status}
              </Badge>
            ) : null}
          </div>

          {specs.length > 0 ? (
            <p className="text-sm text-muted-foreground">{specs.join(' · ')}</p>
          ) : null}

          {showPaid ? (
            <p className="text-sm text-foreground">
              Paid {priceLabel} in {pricePaidYear}
            </p>
          ) : null}

          {onMarket && listLabel ? (
            <p className="text-sm text-muted-foreground">Listed at {listLabel}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
