import { formatPriceCompact } from '@/lib/format/money'
import { zonedDateKey } from '@/lib/format/date'

/**
 * One published price/status timeline for a listing detail page.
 *
 * `listing_history` is the Spark full-history table. Recent live listings
 * often have zero rows there until strict verify. Delta sync already writes
 * `status_history` and `price_history`. A page that reads only
 * `listing_history` hides the timeline the fleet case pack requires.
 *
 * Founding cases (fleet:public-ux:listing-detail 2026-08-17):
 *   61055 Borden (220225742) — listed Jul 22, empty listing_history
 *   61579 Rockway (220226183) — Coming Soon → Active → Pending
 *   61345 Mountain Breezes (220226708) — Coming Soon → Active
 *
 * The published timeline is the merge. Do not invent a price. Listed uses
 * OnMarketDate + ListPrice when no listed/newlisting row already exists.
 *
 * A status event dated before the published listed date is a prior cycle.
 * Foley (220221409) was Active / 2 DOM with OnMarketDate Aug 16 after a
 * Pending Aug 2 fall-through. Publishing that pending before listed
 * contradicts the live listing. Price changes on the same ListingKey stay.
 * Founding case: 2590 Foley (220221409) fleet:07a696dd6362d063f1f6cc1980f3e22f.
 *
 * Buyer-facing copy never prints a raw MLS field dump
 * (`ListPrice: 14900000.00 → 11900000.00`). Price and the dollar delta
 * already sit on the row. Founding case: 65255 Swalley (220207865)
 * fleet:7e278bfeb28c9806649154eeb32c5567.
 */

export type PublishedListingHistoryEvent = {
  event: string
  event_date: string
  price?: number | null
  price_change?: number | null
  description?: string | null
}

export type ListingHistorySourceRow = {
  event?: string | null
  event_date?: string | null
  price?: number | null
  price_change?: number | null
  description?: string | null
}

export type StatusHistorySourceRow = {
  old_status?: string | null
  new_status?: string | null
  changed_at?: string | null
}

export type PriceHistorySourceRow = {
  old_price?: number | null
  new_price?: number | null
  changed_at?: string | null
  change_pct?: number | null
}

function dateOnly(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const trimmed = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  return zonedDateKey(trimmed) || null
}

function normalizeEvent(raw: string | null | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[\s_-]+/g, '')
}

function asPositivePrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

/**
 * Withhold MLS change-log dumps. Keep human prose. Do not rewrite
 * `ListPrice: 14900000.00 → 11900000.00` into a second price line.
 */
export function publishListingHistoryDescription(
  description: string | null | undefined,
): string | null {
  const raw = (description ?? '').trim()
  if (!raw) return null
  if (/^[A-Z][A-Za-z0-9]*:\s*[\d.,]+/.test(raw)) return null
  if (/\bListPrice:\s*[\d.,]+/.test(raw)) return null
  return raw
}

/** Dollar delta for the history rail. `$3.0M down`, never `3,000,000 down`. */
export function publishListingHistoryDeltaLabel(
  amount: number | null | undefined,
  direction: 'down' | 'up',
): string | null {
  const n = asPositivePrice(amount)
  if (n == null) return null
  return `${formatPriceCompact(n)} ${direction}`
}

const STATUS_EVENT: Record<string, string> = {
  pending: 'pending',
  statuspending: 'pending',
  activeundercontract: 'pending',
  contingent: 'contingent',
  statuscontingent: 'contingent',
  active: 'active',
  statusactive: 'active',
  backonmarket: 'backonmarket',
  closed: 'sold',
  sold: 'sold',
  statusclosed: 'sold',
  expired: 'expired',
  statusexpired: 'expired',
  canceled: 'canceled',
  cancelled: 'canceled',
  statuscanceled: 'canceled',
  withdrawn: 'withdrawn',
  statuswithdrawn: 'withdrawn',
}

function statusEvent(newStatus: string | null | undefined): string | null {
  const key = normalizeEvent(newStatus)
  if (!key || key === 'comingsoon') return null
  return STATUS_EVENT[key] ?? null
}

const PUBLISHED_STATUS_EVENTS = new Set<string>(Object.values(STATUS_EVENT))

function isPublishedStatusEvent(event: string): boolean {
  const key = normalizeEvent(event)
  if (!key) return false
  return PUBLISHED_STATUS_EVENTS.has(key) || STATUS_EVENT[key] != null
}

function eventKey(event: string, date: string, price: number | null): string {
  return `${normalizeEvent(event)}|${date}|${price ?? ''}`
}

export function publishListingHistory(input: {
  listingHistory?: ReadonlyArray<ListingHistorySourceRow>
  statusHistory?: ReadonlyArray<StatusHistorySourceRow>
  priceHistory?: ReadonlyArray<PriceHistorySourceRow>
  onMarketDate?: string | null
  listPrice?: number | null
}): PublishedListingHistoryEvent[] {
  const out: PublishedListingHistoryEvent[] = []
  const seen = new Set<string>()

  const push = (row: PublishedListingHistoryEvent) => {
    const date = dateOnly(row.event_date)
    if (!date) return
    const price = asPositivePrice(row.price)
    const key = eventKey(row.event, date, price)
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      event: row.event,
      event_date: date,
      price,
      price_change: row.price_change ?? null,
      description: publishListingHistoryDescription(row.description),
    })
  }

  for (const row of input.listingHistory ?? []) {
    if (!row.event?.trim()) continue
    const event = normalizeEvent(row.event)
    const isPriceEvent = event === 'pricechange' || event === 'pricedrop' || event === 'priceincrease'
    if (isPriceEvent && row.price_change === 0) continue
    push({
      event: row.event,
      event_date: row.event_date ?? '',
      price: row.price,
      price_change: row.price_change,
      description: row.description,
    })
  }

  const listedDate = dateOnly(input.onMarketDate)
  const listPrice = asPositivePrice(input.listPrice)
  if (listedDate) {
    const alreadyListed = [...seen].some((k) => k.startsWith('listed|') || k.startsWith('newlisting|'))
    if (!alreadyListed) {
      push({
        event: 'listed',
        event_date: listedDate,
        price: listPrice,
      })
    }
  }

  for (const row of input.statusHistory ?? []) {
    const event = statusEvent(row.new_status)
    const date = dateOnly(row.changed_at)
    if (!event || !date) continue
    const oldKey = normalizeEvent(row.old_status)
    if (oldKey === 'comingsoon' && event === 'active' && date === listedDate) continue
    if (event === 'active' && date === listedDate) continue
    push({
      event,
      event_date: date,
      price: listPrice,
    })
  }

  for (const row of input.priceHistory ?? []) {
    const date = dateOnly(row.changed_at)
    const newPrice = asPositivePrice(row.new_price)
    const oldPrice = asPositivePrice(row.old_price)
    if (!date || newPrice == null) continue
    if (oldPrice != null && newPrice === oldPrice) continue
    push({
      event: 'pricechange',
      event_date: date,
      price: newPrice,
      price_change: oldPrice != null ? newPrice - oldPrice : null,
    })
  }

  const listedCutoff =
    listedDate ??
    out
      .filter((row) => {
        const key = normalizeEvent(row.event)
        return key === 'listed' || key === 'newlisting'
      })
      .map((row) => row.event_date)
      .sort()
      .at(-1) ?? null

  return out
    .filter((row) => {
      if (!listedCutoff) return true
      if (!isPublishedStatusEvent(row.event)) return true
      return row.event_date >= listedCutoff
    })
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .filter((row, i, rows) => {
      const key = normalizeEvent(row.event)
      if (key !== 'pricechange' && key !== 'pricedrop' && key !== 'priceincrease') return true
      const prev = [...rows.slice(0, i)].reverse().find((r) => r.price != null)
      if (prev && prev.price === row.price && (row.price_change == null || row.price_change === 0)) {
        return false
      }
      return true
    })
}
