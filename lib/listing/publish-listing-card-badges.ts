/**
 * Listing card badges. One publisher so search Split, area
 * pages, and any other card show the same facts.
 *
 * Order (max 3): status · Open · New · Reduced · 3D tour.
 * Miss omits. Open is an upcoming public open house, not a standing builder spec.
 *
 * Matt lock 2026-09-15: a price drop must show the change AND the date.
 * An open house must show that it is open AND when. Bare "Price reduced"
 * or "Open" without those facts does not ship.
 */
import { publishListingStatusBadge } from '@/lib/search/publish-search-status'
import { formatPriceCompact } from '@/lib/format/money'
import { formatDate } from '@/lib/format/date'

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

function formatDropDate(iso: string | null | undefined): string | null {
  const raw = (iso ?? '').trim()
  if (!raw) return null
  const formatted = formatDate(raw, { month: 'short', day: 'numeric', year: undefined })
  if (!formatted || formatted === '—') return null
  return formatted
}

function positiveAmount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

/**
 * Short open-house label: "Open Sat" or "Open Sat 1pm".
 * Returns null when the weekday is unknown — never a bare "Open".
 */
export function publishOpenHouseBadgeLabel(
  dateIso: string | null | undefined,
  startTime?: string | null,
): string | null {
  const day = (dateIso ?? '').slice(0, 10)
  const parsed = day ? new Date(`${day}T12:00:00-07:00`) : null
  const weekday =
    parsed && Number.isFinite(parsed.getTime()) ? WEEKDAYS[parsed.getDay()] : null
  if (!weekday) return null
  const hour = hourLabel(startTime)
  if (hour) return `Open ${weekday} ${hour}`
  return `Open ${weekday}`
}

/** Dated price-cut label, or null. Never a bare "Price reduced". */
export function publishListingDropBadge(input: {
  lastPriceChangeTimestamp?: string | null
  priceDropAmount?: number | null
  lastPriceChangePercent?: number | null
  listPrice?: number | null
  originalListPrice?: number | null
}): string | null {
  const date = formatDropDate(input.lastPriceChangeTimestamp)
  if (!date) return null

  const fromOriginal =
    input.originalListPrice != null &&
    input.listPrice != null &&
    Number.isFinite(input.originalListPrice) &&
    Number.isFinite(input.listPrice) &&
    input.originalListPrice > input.listPrice
      ? input.originalListPrice - input.listPrice
      : null
  const amount = positiveAmount(input.priceDropAmount) ?? positiveAmount(fromOriginal)
  if (amount == null) return null

  const dollars = formatPriceCompact(amount)
  const pctRaw =
    input.lastPriceChangePercent != null && Number.isFinite(input.lastPriceChangePercent)
      ? input.lastPriceChangePercent
      : input.originalListPrice != null &&
          Number.isFinite(input.originalListPrice) &&
          input.originalListPrice > 0
        ? (amount / input.originalListPrice) * 100
        : null
  const pct =
    pctRaw != null && Number.isFinite(pctRaw) && pctRaw > 0
      ? Math.round(pctRaw * 10) / 10
      : null
  if (pct != null) return `−${dollars} (−${pct}%) · ${date}`
  return `−${dollars} · ${date}`
}

export function publishListingCardBadges(input: {
  nowMs: number
  standardStatus?: string | null
  onMarketDate?: string | null
  priceDropCount?: number | null
  /** Original minus current ask, when both are published. */
  priceDropAmount?: number | null
  lastPriceChangeTimestamp?: string | null
  lastPriceChangePercent?: number | null
  listPrice?: number | null
  originalListPrice?: number | null
  hasVirtualTour?: boolean | null
  hasTourUrl?: boolean | null
  openHouseLabel?: string | null
}): ListingCardBadge[] {
  const badges: ListingCardBadge[] = []
  const status = publishListingStatusBadge(input.standardStatus)
  if (status) badges.push(status)

  const openLabel = input.openHouseLabel?.trim() || null
  if (openLabel && /^Open\s+(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/.test(openLabel)) {
    badges.push({ kind: 'open', label: openLabel })
  }

  if (input.onMarketDate) {
    const days = (input.nowMs - new Date(input.onMarketDate).getTime()) / 86_400_000
    if (Number.isFinite(days) && days >= 0 && days <= NEW_LISTING_WINDOW_DAYS) {
      badges.push({ kind: 'new', label: 'New' })
    }
  }

  const dropLabel = publishListingDropBadge({
    lastPriceChangeTimestamp: input.lastPriceChangeTimestamp,
    priceDropAmount: input.priceDropAmount,
    lastPriceChangePercent: input.lastPriceChangePercent,
    listPrice: input.listPrice,
    originalListPrice: input.originalListPrice,
  })
  if (dropLabel) {
    badges.push({ kind: 'drop', label: dropLabel })
  }

  if (input.hasVirtualTour === true || input.hasTourUrl === true) {
    badges.push({ kind: 'video', label: '3D Walkthrough' })
  }
  // Coming Soon is in the MLS feed and MUST NOT print on public cards
  // (lib/listing-status-public.ts). We do not invent a demand score.

  return badges.slice(0, 3)
}
