'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ActivityFeedItem } from '@/app/actions/activity-feed'

function eventLabel(type: ActivityFeedItem['event_type']): string {
  switch (type) {
    case 'new_listing':
      return 'New to market'
    case 'price_drop':
      return 'Price drop'
    case 'status_pending':
      return 'Pending'
    case 'status_closed':
      return 'Sold'
    default:
      return type
  }
}

function eventBadgeVariant(
  type: ActivityFeedItem['event_type']
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (type) {
    case 'new_listing':
      return 'default'
    case 'price_drop':
      return 'secondary'
    case 'status_pending':
      return 'outline'
    case 'status_closed':
      return 'secondary'
    default:
      return 'outline'
  }
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatAddress(item: ActivityFeedItem): string {
  const street = [item.StreetNumber, item.StreetName].filter(Boolean).join(' ').trim()
  const parts = [street, item.City].filter(Boolean) as string[]
  return parts.join(', ') || 'Listing'
}

export type ActivityFeedCardProps = {
  item: ActivityFeedItem
  /** When true, image loads with priority (e.g. first few in slider). */
  priority?: boolean
  className?: string
}

export default function ActivityFeedCard({ item, priority = false, className }: ActivityFeedCardProps) {
  const listingHref = `/listing/${encodeURIComponent(item.listing_key)}`
  const isPriceDrop = item.event_type === 'price_drop'
  const previousPrice = isPriceDrop && item.payload?.previous_price != null ? Number(item.payload.previous_price) : null
  const newPrice = isPriceDrop && item.payload?.new_price != null ? Number(item.payload.new_price) : item.ListPrice

  return (
    <Card className={cn('group/card flex h-full flex-col overflow-hidden', className)}>
      <Link href={listingHref} className="relative block aspect-[4/3] w-full overflow-hidden bg-muted">
        {item.PhotoURL ? (
          <Image
            src={item.PhotoURL}
            alt=""
            fill
            className="object-cover transition-transform group-hover/card:scale-[1.02]"
            sizes="(max-width: 640px) 85vw, 320px"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground" aria-hidden>
            No photo
          </div>
        )}
        <div className="absolute left-2 top-2">
          <Badge variant={eventBadgeVariant(item.event_type)} className="text-xs">
            {eventLabel(item.event_type)}
          </Badge>
        </div>
      </Link>
      <CardContent className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{formatAddress(item)}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {item.BedroomsTotal != null && (
            <span>{item.BedroomsTotal} bed</span>
          )}
          {item.BathroomsTotal != null && (
            <span>{item.BathroomsTotal} bath</span>
          )}
          {item.City && <span> · {item.City}</span>}
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-sm font-semibold text-primary">
            {isPriceDrop && previousPrice != null ? (
              <>
                <span className="line-through text-muted-foreground">{formatPrice(previousPrice)}</span>
                {' → '}
                {formatPrice(newPrice ?? undefined)}
              </>
            ) : (
              formatPrice(item.ListPrice ?? newPrice ?? undefined)
            )}
          </span>
          <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
            <Link href={listingHref}>View listing</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
