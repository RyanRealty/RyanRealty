/**
 * Activity feed rows. A row earns a place when it has a listing key and a
 * street. Dates go through formatDate (Pacific), never toLocaleDateString.
 */

import type { V3LedgerFigureRow } from '@/components/site/v3'
import { v3Text } from '@/components/site/v3'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import { listingTileHref } from '@/lib/slug'
import { livePrice, liveStamp } from '@/app/_v3/live-format'

const ACTIVITY_LABEL: Record<string, string> = {
  new_listing: 'New',
  price_drop: 'Price cut',
  status_pending: 'Pending',
  status_closed: 'Sold',
  back_on_market: 'Back on market',
  status_expired: 'Off market',
}

export function activityRows(items: readonly ActivityFeedItem[]): V3LedgerFigureRow[] {
  const rows: V3LedgerFigureRow[] = []
  for (const a of items) {
    const key = a.listing_key?.trim()
    if (!key) continue
    const street = [a.StreetNumber, a.StreetName, a.StreetSuffix]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (!street) continue
    const price = livePrice(a.ListPrice ?? null)
    if (!price) continue
    const when = liveStamp(a.event_at)
    if (!when) continue
    const kind = ACTIVITY_LABEL[a.event_type] ?? a.event_type
    const cityLine = [a.City, a.SubdivisionName].filter(Boolean).join(' · ')
    const detail = [kind, cityLine].filter((part) => part && part.trim().length > 0).join(' · ')
    rows.push({
      href: listingTileHref({
        listingKey: key,
        listNumber: a.ListNumber ?? null,
        streetNumber: a.StreetNumber ?? null,
        streetName: a.StreetName ?? null,
        city: a.City ?? null,
        subdivisionName: a.SubdivisionName ?? null,
      }),
      when,
      what: v3Text(street),
      detail: detail ? v3Text(detail) : undefined,
      value: v3Text(price),
      id: a.id,
      ...(a.PhotoURL ? { media: { src: a.PhotoURL } } : {}),
    })
  }
  return rows
}
