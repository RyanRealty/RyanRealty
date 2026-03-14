'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { ActivityFeedItem } from '@/app/actions/activity-feed'
import { Badge } from '@/components/ui/badge'

type Props = {
  item: ActivityFeedItem
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function eventLabel(type: ActivityFeedItem['event_type']): string {
  switch (type) {
    case 'new_listing':
      return 'New listing'
    case 'price_drop':
      return 'Price reduced'
    case 'status_pending':
      return 'Went pending'
    case 'status_closed':
      return 'Closed'
    default:
      return 'Activity'
  }
}

function eventBadgeVariant(type: ActivityFeedItem['event_type']): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (type) {
    case 'new_listing':
      return 'default'
    case 'price_drop':
      return 'destructive'
    case 'status_pending':
      return 'secondary'
    case 'status_closed':
      return 'outline'
    default:
      return 'default'
  }
}

/** Single activity feed card for Latest activity slider. Same general size as listing/community tiles; badged by event type. */
export default function ActivityFeedCard({ item }: Props) {
  const address = [item.StreetNumber, item.StreetName].filter(Boolean).join(' ').trim() || 'Property'
  const href = `/listing/${encodeURIComponent(item.listing_key)}`

  return (
    <Link
      href={href}
      className="group flex h-full min-h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
        {item.PhotoURL ? (
          <Image
            src={item.PhotoURL}
            alt={`${address} — ${eventLabel(item.event_type).toLowerCase()}`}
            fill
            className="object-cover transition group-hover:scale-[1.02]"
            sizes="(max-width: 640px) 320px, (max-width: 1024px) 360px, 420px"
          />
        ) : (
          <div className="absolute inset-0 bg-primary/10" />
        )}
        <div className="absolute left-2 top-2">
          <Badge variant={eventBadgeVariant(item.event_type)}>{eventLabel(item.event_type)}</Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="font-medium text-primary line-clamp-2">{address}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatPrice(item.ListPrice)}
          {item.BedroomsTotal != null && ` · ${item.BedroomsTotal} bed`}
        </p>
      </div>
    </Link>
  )
}
