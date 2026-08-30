/**
 * Listing card badges. One publisher so search Split, area
 * pages, and any other card show the same facts.
 *
 * Order (max 3): status · Open · New · Reduced · 3D tour.
 * Miss omits. Open is an upcoming public open house, not a standing builder spec.
 */
import { publishListingStatusBadge } from '@/lib/search/publish-search-status'
import { formatPriceCompact } from '@/lib/format/money'

export type ListingCardBadgeKind = 'hot' | 'new' | 'drop' | 'open' | 'sold' | 'pending' | 'video'

export type ListingCardBadge = { kind: ListingCardBadgeKind; label: string }

const NEW_LISTING_WINDOW_DAYS = 7
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

function hourLabel(time: string | null | undefined): string | null {
  const raw = (time ?? '').trim()
  const m = raw.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  let hour = Number(m[1])
  if (!Number.isFinite(hour)) return null
  const suffix = hour >= 12 ? 'pm' : 'am'
  hour = hour % 12
  if (hour === 0) hour = 12
  return `${hour}${suffix}`
}

/** Short open-house label: "Open Sat" or "Open Sat 1pm". */
export function publishOpenHouseBadgeLabel(
  dateIso: string | null | undefined,
  startTime?: string | null,
): string {
  const day = (dateIso ?? '').slice(0, 10)
  const parsed = day ? new Date(`${day}T12:00:00-07:00`) : null
  const weekday =
    parsed && Number.isFinite(parsed.getTime()) ? WEEKDAYS[parsed.getDay()] : null
  const hour = hourLabel(startTime)
  if (weekday && hour) return `Open ${weekday} ${hour}`
  if (weekday) return `Open ${weekday}`
  return 'Open'
}

export function publishListingCardBadges(input: {
  nowMs: number
  standardStatus?: string | null
  onMarketDate?: string | null
  priceDropCount?: number | null
  /** Original minus current ask, when both are published. */
  priceDropAmount?: number | null
  hasVirtualTour?: boolean | null
  hasTourUrl?: boolean | null
  openHouseLabel?: string | null
}): ListingCardBadge[] {
  const badges: ListingCardBadge[] = []
  const status = publishListingStatusBadge(input.standardStatus)
  if (status) badges.push(status)

  if (input.openHouseLabel) {
    badges.push({ kind: 'open', label: input.openHouseLabel })
  }

  if (input.onMarketDate) {
    const days = (input.nowMs - new Date(input.onMarketDate).getTime()) / 86_400_000
    if (Number.isFinite(days) && days >= 0 && days <= NEW_LISTING_WINDOW_DAYS) {
      badges.push({ kind: 'new', label: 'New' })
    }
  }

  if (input.priceDropCount != null && input.priceDropCount > 0) {
    const drop = input.priceDropAmount
    badges.push({
      kind: 'drop',
      label:
        drop != null && drop > 0
          ? `Price reduced ${formatPriceCompact(drop)}`
          : 'Price reduced',
    })
  }

  if (input.hasVirtualTour === true || input.hasTourUrl === true) {
    badges.push({ kind: 'video', label: '3D Walkthrough' })
  }
  // Coming Soon is in the MLS feed and MUST NOT print on public cards
  // (lib/listing-status-public.ts). We do not invent a demand score.

  return badges.slice(0, 3)
}
