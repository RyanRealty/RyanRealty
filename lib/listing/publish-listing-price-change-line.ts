/**
 * One honest price-change line from the published history rail.
 *
 * The listing hero does not paint this. Sale history is the buyer-facing
 * place for PRICE CHANGE, and only when the dollar amount actually moved.
 *
 * Copy:
 *   "Reduced $X on {date}" when a negative price_change exists
 *   "Listed {date} at $X" when a listed/newlisting row has a price
 */

import { formatDate } from '@/lib/format/date'
import { formatListingAsk } from './publish-listing-ask'
import type { PublishedListingHistoryEvent } from './publish-listing-history'

export type ListingPriceChangeLine = {
  text: string
  kind: 'reduced' | 'listed'
}

function normalizeEvent(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[\s_-]+/g, '')
}

function asPositivePrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

function shortDate(iso: string): string | null {
  const formatted = formatDate(iso, { month: 'short', day: 'numeric', year: undefined })
  if (!formatted || formatted === '—') return null
  return formatted
}

export function publishListingPriceChangeLine(
  history: ReadonlyArray<PublishedListingHistoryEvent> | null | undefined,
): ListingPriceChangeLine | null {
  const rows = history ?? []

  const reductions = rows.filter((row) => {
    const event = normalizeEvent(row.event)
    if (event !== 'pricechange' && event !== 'pricedrop') return false
    return row.price_change != null && Number.isFinite(row.price_change) && row.price_change < 0
  })
  const latestReduction = reductions[reductions.length - 1]
  if (latestReduction) {
    const date = shortDate(latestReduction.event_date)
    const drop = asPositivePrice(Math.abs(latestReduction.price_change ?? 0))
    if (date && drop != null) {
      return {
        kind: 'reduced',
        text: `Reduced ${formatListingAsk(drop)} on ${date}`,
      }
    }
  }

  const listed = rows.find((row) => {
    const event = normalizeEvent(row.event)
    return event === 'listed' || event === 'newlisting'
  })
  if (listed) {
    const date = shortDate(listed.event_date)
    const price = asPositivePrice(listed.price)
    if (date && price != null) {
      return {
        kind: 'listed',
        text: `Listed ${date} at ${formatListingAsk(price)}`,
      }
    }
  }

  return null
}
