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

const EVENT_LABEL: Record<string, string> = {
  new_listing: 'Listed',
  price_change: 'Price change',
  price_drop: 'Price drop',
  price_increase: 'Price increase',
  status_change: 'Status change',
  status_pending: 'Pending',
  status_closed: 'Closed',
  status_expired: 'Expired',
  status_canceled: 'Canceled',
  status_withdrawn: 'Withdrawn',
  back_on_market: 'Back on market',
}

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
  if (!raw) return 'Event'
  return EVENT_LABEL[raw] ?? raw.replace(/_/g, ' ')
}

function isMeaningfulEvent(ev: ListingHistoryEvent): boolean {
  const raw = (ev.event ?? '').toLowerCase()
  if (raw === 'photo' || raw === 'photos' || raw === 'photo_change') return false
  if (raw === 'fieldchange' || raw === 'field_change') {
    if (ev.price_change && ev.price_change !== 0) return true
    if (ev.description && ev.description.trim().length > 8) return true
    return false
  }
  return true
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
          const label = eventLabel(ev.event)
          const dropAmount =
            ev.price_change && ev.price_change < 0 ? Math.abs(ev.price_change) : null
          const increaseAmount =
            ev.price_change && ev.price_change > 0 ? ev.price_change : null
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
                    color: 'rgba(16,39,66,0.55)',
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
                      fontFamily: 'var(--font-amboqia, serif)',
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
                  <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
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
