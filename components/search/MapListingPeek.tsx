'use client'

import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPriceExact } from '@/lib/format/money'
import { cn } from '@/lib/utils'

export type MapListingPeekData = {
  photoURL: string | null
  price: number | null
  streetLine: string
  cityLine: string
  beds: number | null
  baths: number | null
  sqft: number | null
  href: string
}

export function MapListingPeek({
  listing,
  className,
}: {
  listing: MapListingPeekData
  className?: string
}) {
  const stats: string[] = []
  if (listing.beds != null) stats.push(`${Math.round(listing.beds)} bd`)
  if (listing.baths != null) stats.push(`${Math.round(listing.baths)} ba`)
  if (listing.sqft != null) stats.push(`${Math.round(listing.sqft).toLocaleString()} sqft`)

  return (
    <Link
      href={listing.href}
      className={cn(
        'srch-map-peek block w-64 max-w-[calc(100%-1.5rem)] outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Card size="sm" data-srch-map-peek="">
        {listing.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element -- peek is a map overlay, not the listing hero
          <img
            src={listing.photoURL}
            alt={listing.streetLine || 'Listing photo'}
            width={256}
            height={144}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="aspect-video w-full bg-muted" aria-hidden />
        )}
        <CardHeader>
          <CardTitle className="tabular-nums">{formatPriceExact(listing.price)}</CardTitle>
          {listing.streetLine ? (
            <p className="truncate text-sm text-foreground">{listing.streetLine}</p>
          ) : null}
          {listing.cityLine ? (
            <p className="truncate text-xs text-muted-foreground">{listing.cityLine}</p>
          ) : null}
          {stats.length > 0 ? (
            <p className="tabular-nums text-xs text-muted-foreground">{stats.join(' · ')}</p>
          ) : null}
        </CardHeader>
      </Card>
    </Link>
  )
}
