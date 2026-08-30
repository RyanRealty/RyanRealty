import { Price } from '@/components/site/primitives'
import { publishHistoryDay } from '@/lib/listing/publish-calendar-day'
import {
  publishListingHistoryDeltaLabel,
  publishListingHistoryDescription,
} from '@/lib/listing/publish-listing-history'

/**
 * Listing-detail PropertyHistory — KB section style.
 * Navy sec-head, Amboqia heading, timeline rows with 1px edge borders.
 *
 * Per CLAUDE.md §0: Price / TabularNumber for every figure.
 */

export type ListingHistoryEvent = {
  event?: string
  event_date?: string | null
  price?: number | null
  price_change?: number | null
  description?: string | null
}

type Props = {
  history: ReadonlyArray<ListingHistoryEvent>
  mode?: 'all' | 'meaningful-only'
  className?: string
}

// Canonical key = lowercased with every separator stripped, so the lowercase_under-
// score form AND the raw UPPERCASE MLS code ("NEWLISTING", "PRICECHANGE") both map.
function normalizeEvent(raw: string | undefined): string {
  return (raw ?? '').toLowerCase().replace(/[\s_-]+/g, '')
}

const EVENT_LABEL: Record<string, string> = {
  newlisting: 'Listed',
  listed: 'Listed',
  pricechange: 'Price change',
  pricedrop: 'Price drop',
  priceincrease: 'Price increase',
  statuschange: 'Status change',
  pending: 'Pending',
  statuspending: 'Pending',
  active: 'Active',
  statusactive: 'Active',
  backonmarket: 'Back on market',
  contingent: 'Contingent',
  statuscontingent: 'Contingent',
  closed: 'Sold',
  sold: 'Sold',
  statusclosed: 'Sold',
  expired: 'Expired',
  statusexpired: 'Expired',
  canceled: 'Canceled',
  cancelled: 'Canceled',
  statuscanceled: 'Canceled',
  withdrawn: 'Withdrawn',
  statuswithdrawn: 'Withdrawn',
}

// Only price + status moments belong in the buyer-facing history. MLS change-log
// noise (document uploads, photo swaps, text/field edits, tour/open-house pings)
// is filtered out — that wall of "DOCUMENT / PHOTO / TEXTCHANGE" rows is not history.
const MEANINGFUL_EVENTS = new Set(Object.keys(EVENT_LABEL))

function formatDate(iso: string | null | undefined): string {
  return publishHistoryDay(iso)
}

function eventLabel(raw: string | undefined): string {
  const key = normalizeEvent(raw)
  if (!key) return 'Update'
  return EVENT_LABEL[key] ?? raw!.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isMeaningfulEvent(ev: ListingHistoryEvent): boolean {
  if (MEANINGFUL_EVENTS.has(normalizeEvent(ev.event))) return true
  // A generic/unknown change still counts when it actually moved the price.
  if (ev.price_change && ev.price_change !== 0) return true
  return false
}

export function PropertyHistory({ history, mode = 'all', className }: Props) {
  const filtered = mode === 'meaningful-only' ? history.filter(isMeaningfulEvent) : history
  const events = [...filtered].sort((a, b) => {
    const ta = a.event_date ? Date.parse(a.event_date) : 0
    const tb = b.event_date ? Date.parse(b.event_date) : 0
    return tb - ta
  })
  if (events.length === 0) return null

  return (
    <section className={className}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">History</div>
          <h2 className="sec-title">Sale and tax history</h2>
        </div>
      </div>

      <table className="listing-hist">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event</th>
            <th className="listing-hist__price">Price</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev, i) => {
            const prevPrice = events.slice(i + 1).find((e) => e.price != null)?.price ?? null
            const delta = ev.price != null && prevPrice != null ? ev.price - prevPrice : null
            const norm = normalizeEvent(ev.event)
            const isPriceEvent =
              norm === 'pricechange' || norm === 'pricedrop' || norm === 'priceincrease'
            const storedDelta = ev.price_change != null && ev.price_change !== 0 ? ev.price_change : null
            if (isPriceEvent && (delta == null || delta === 0) && storedDelta == null) return null
            let label = eventLabel(ev.event)
            if (!EVENT_LABEL[norm]) {
              if (delta && delta < 0) label = 'Price drop'
              else if (delta && delta > 0) label = 'Price increase'
              else if (ev.price != null && (delta == null || delta === 0)) return null
            }
            const dropAmount = delta && delta < 0 ? Math.abs(delta) : null
            const increaseAmount = delta && delta > 0 ? delta : null
            const publishedDescription = publishListingHistoryDescription(ev.description)
            const dropLabel = publishListingHistoryDeltaLabel(dropAmount, 'down')
            const increaseLabel = publishListingHistoryDeltaLabel(increaseAmount, 'up')
            return (
              <tr key={`${i}-${ev.event}-${ev.event_date}`}>
                <td className="mono-num">{formatDate(ev.event_date)}</td>
                <td>
                  {label}
                  {publishedDescription ? (
                    <span className="listing-hist__desc">{publishedDescription}</span>
                  ) : null}
                </td>
                <td className="listing-hist__price">
                  {ev.price ? <Price value={ev.price} /> : '—'}
                  {dropLabel ? <span className="listing-hist__delta">{dropLabel}</span> : null}
                  {increaseLabel ? <span className="listing-hist__delta">{increaseLabel}</span> : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
