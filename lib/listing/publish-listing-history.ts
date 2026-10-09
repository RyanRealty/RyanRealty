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
 * OnMarketDate plus the first price_history old_price dated on or after
 * that day (the original ask of this cycle). Current ListPrice is the
 * fallback only when no later cut exists. Founding case: 909 NW Delaware
 * (220222734) listed Jun 4 at $1,195,000, not the live $999,000 ask.
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

/**
 * Original ask of the current cycle: earliest price_history old_price on or
 * after the listed date. Prior-cycle cuts (Foley) stay off this listed row.
 */
function listedAskFromPriceHistory(
  priceHistory: ReadonlyArray<PriceHistorySourceRow> | undefined,
  listedDate: string | null,
  originalListPrice: number | null,
  listPrice: number | null,
): number | null {
  if (!listedDate) return listPrice
  const later = (priceHistory ?? [])
    .map((row) => ({
      date: dateOnly(row.changed_at),
      old: asPositivePrice(row.old_price),
    }))
    .filter((row): row is { date: string; old: number } => row.date != null && row.old != null && row.date >= listedDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  return later[0]?.old ?? originalListPrice ?? listPrice
}

/**
 * Most recent cut on the published rail. Face is last drop ($76K),
 * not original-minus-ask.
 */
export function publishListingLastDrop(
  rows: ReadonlyArray<{
    event?: string | null
    event_date?: string | null
    price_change?: number | null
  }>,
): { amount: number; label: string } | null {
  const dated = [...rows].filter(
    (row): row is { event: string; event_date: string; price_change?: number | null } =>
      Boolean(row.event && row.event_date),
  )
  const listedCutoff =
    dated
      .filter((row) => {
        const key = normalizeEvent(row.event)
        return key === 'listed' || key === 'newlisting'
      })
      .map((row) => row.event_date)
      .sort()
      .at(-1) ?? null
  const newestFirst = dated
    .filter((row) => !listedCutoff || row.event_date >= listedCutoff)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
  for (const row of newestFirst) {
    const key = normalizeEvent(row.event)
    if (key !== 'pricechange' && key !== 'pricedrop') continue
    const change = row.price_change
    if (change == null || !Number.isFinite(change)) continue
    // A RISE NEWER THAN THE CUT ENDS THE SEARCH (2026-09-11) — the same rule
    // publishListingDropMark applies, for the same reason and on the same
    // rows. These two must agree: the mark draws the cut and this labels it,
    // so if one reaches past a price increase and the other does not, the page
    // shows a badge naming a cut the mark refuses to draw. Newest-first, the
    // first real price action decides; a rise means no cut is current.
    if (change > 0) return null
    if (change === 0) continue
    const amount = Math.round(Math.abs(change))
    return { amount, label: `Price drop ${formatPriceCompact(amount)}` }
  }
  return null
}

export function publishListingHistory(input: {
  listingHistory?: ReadonlyArray<ListingHistorySourceRow>
  statusHistory?: ReadonlyArray<StatusHistorySourceRow>
  priceHistory?: ReadonlyArray<PriceHistorySourceRow>
  onMarketDate?: string | null
  listPrice?: number | null
  originalListPrice?: number | null
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
  const listedAsk = listedAskFromPriceHistory(
    input.priceHistory,
    listedDate,
    asPositivePrice(input.originalListPrice),
    listPrice,
  )
  if (listedDate) {
    const alreadyListed = [...seen].some((k) => k.startsWith('listed|') || k.startsWith('newlisting|'))
    if (!alreadyListed) {
      push({
        event: 'listed',
        event_date: listedDate,
        price: listedAsk,
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

/**
 * The price a SALE row in the history rail publishes (SITE-21).
 *
 * FOUNDING CASE, measured on a dev render 2026-09-09 of Closed MLS 220224752:
 * the sold instrument read "Sold for $827,000 on September 8, 2026" while the
 * history rail further down the same page read "Sep 8, 2026 · Sold ·
 * $849,000". Two prices for one sale on one page, which is the §0 failure this
 * node exists to end. The rail was not wrong about its own row — the MLS
 * change-log event that flips the status to Closed carries the then-current
 * LIST price — but a row LABELLED Sold publishes a sale, and the price of a
 * sale is the ClosePrice.
 *
 * So a sale row publishes the close price or NO price. There is no fallback to
 * the ask, for the same reason publish-listing-published-price has none: the
 * list price of a home that already sold, printed under the word Sold, IS the
 * defect. A row with no publishable price renders a dash; the ask is still
 * visible on its own Listed and Price change rows, where it is true.
 */
export function publishHistoryRowPrice(input: {
  /** True when this row's published LABEL is the sale ("Sold"). */
  isSale: boolean
  /** The price the merged history row carries. */
  rowPrice: number | null | undefined
  /** ClosePrice from the listing row, or null when the feed withholds it. */
  closePrice: number | null | undefined
}): number | null {
  if (!input.isSale) return input.rowPrice ?? null
  const close = input.closePrice
  return close != null && Number.isFinite(close) && close > 0 ? close : null
}
