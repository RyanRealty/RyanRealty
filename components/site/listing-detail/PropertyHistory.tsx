import {
  Price,
  TabularNumber,
} from '@/components/site/primitives'

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
  comingsoon: 'Coming soon',
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
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Los_Angeles',
    })
  } catch {
    return iso
  }
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
          <h2 className="sec-title display">Listing history</h2>
        </div>
      </div>

      <ol
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          marginTop: 'clamp(22px,3vw,36px)',
        }}
      >
        {events.map((ev, i) => {
          // Derive the price move from the actual sequence (newest-first), not the
          // unreliable MLS price_change field (often 0 on a field-change row).
          const prevPrice = events.slice(i + 1).find((e) => e.price != null)?.price ?? null
          // Only a REAL delta (from the price sequence) drives the up/down amount.
          // The oldest row has no prior price, so it shows just its price, no "0 down".
          const delta = ev.price != null && prevPrice != null ? ev.price - prevPrice : null
          const norm = normalizeEvent(ev.event)
          // A generic/unknown event that's here because it moved the price reads as a
          // price event, not the raw "FieldChange".
          let label = eventLabel(ev.event)
          if (!EVENT_LABEL[norm]) {
            if (delta && delta < 0) label = 'Price drop'
            else if (delta && delta > 0) label = 'Price increase'
            else if (ev.price != null) label = 'Price change'
          }
          const dropAmount = delta && delta < 0 ? Math.abs(delta) : null
          const increaseAmount = delta && delta > 0 ? delta : null
          return (
            <li
              key={`${i}-${ev.event}-${ev.event_date}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                padding: '14px 0',
                borderTop: i === 0 ? 'none' : '1px solid rgba(16,39,66,0.12)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--navy, #102742)',
                  }}
                >
                  {label}
                </div>
                <div
                  className="mono-num"
                  style={{
                    fontSize: '0.72rem',
                    color: 'rgba(16,39,66,0.72)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatDate(ev.event_date)}
                </div>
                {ev.description ? (
                  <p
                    style={{
                      marginTop: 4,
                      fontSize: '0.82rem',
                      lineHeight: 1.5,
                      color: 'rgba(16,39,66,0.65)',
                      maxWidth: '60ch',
                    }}
                  >
                    {ev.description}
                  </p>
                ) : null}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {ev.price ? (
                  <div
                    style={{
                      fontFamily: 'var(--font-amboqia-safe, serif)',
                      fontSize: 'clamp(1rem,2vw,1.3rem)',
                      lineHeight: 1,
                      color: 'var(--navy, #102742)',
                      fontVariantNumeric: 'tabular-nums',
                      overflow: 'visible',
                    }}
                  >
                    <Price value={ev.price} />
                  </div>
                ) : null}
                {dropAmount ? (
                  <div style={{ fontSize: '0.72rem', color: 'rgba(16,39,66,0.72)', fontVariantNumeric: 'tabular-nums' }}>
                    <TabularNumber value={dropAmount} fallback="—" />{' down'}
                  </div>
                ) : null}
                {increaseAmount ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--navy, #102742)', fontVariantNumeric: 'tabular-nums' }}>
                    <TabularNumber value={increaseAmount} />{' up'}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
