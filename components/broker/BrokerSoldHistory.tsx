'use client'

import Link from 'next/link'
import type { HomeTileRow } from '@/app/actions/listings'
import { trackEvent } from '@/lib/tracking'
import { TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'
import TilesSlider, { TilesSliderItem } from '@/components/TilesSlider'

type SoldRow = HomeTileRow & { ClosePrice?: number | null; CloseDate?: string | null }

type Props = {
  brokerFirstName: string
  soldListings: SoldRow[]
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function BrokerSoldHistory({ brokerFirstName, soldListings }: Props) {
  const displayList = soldListings.slice(0, 12)

  if (displayList.length === 0) {
    return (
      <section className="bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-sold-heading">
        <div className="mx-auto max-w-7xl">
          <h2 id="broker-sold-heading" className="text-2xl font-bold tracking-tight text-primary">
            Recent Sales
          </h2>
          <p className="mt-6 text-muted-foreground">No recent sales to display.</p>
        </div>
      </section>
    )
  }

  const subtitle =
    soldListings.length > 12
      ? `${soldListings.length} sales (24 mo) · Showing 12`
      : `${soldListings.length} sales (24 mo)`

  return (
    <section className="bg-card px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-sold-heading">
      <div className="mx-auto max-w-7xl">
        <TilesSlider
          title="Recent Sales"
          subtitle={subtitle}
          titleId="broker-sold-heading"
        >
          {displayList.map((listing) => {
            const key = listing.ListingKey ?? listing.ListNumber ?? ''
            return (
              <TilesSliderItem key={String(key)} style={{ minHeight: TILE_MIN_HEIGHT_PX }}>
                <Link
                  href={`/listing/${key}`}
                  className="block h-full rounded-lg border border-border bg-muted p-4 transition hover:shadow-md"
                  onClick={() => trackEvent('view_listing', { context: 'broker_sold_history', listing_key: String(key) })}
                >
                  <p className="font-semibold text-primary">
                    {[listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ')} {listing.City}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sold {formatPrice(listing.ClosePrice)} · {formatDate(listing.CloseDate)}
                  </p>
                </Link>
              </TilesSliderItem>
            )
          })}
        </TilesSlider>
      </div>
    </section>
  )
}
