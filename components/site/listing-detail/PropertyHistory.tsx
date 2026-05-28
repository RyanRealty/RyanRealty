import {
  Body,
  Eyebrow,
  H2,
  Price,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'

/**
 * Listing-detail PropertyHistory — chronological timeline of the
 * listing's lifecycle events: listed, price change, status change,
 * pending, closed, etc. Reads from `listing_history` via the DAL
 * function `getListingDetailHistory(listingKey)`.
 *
 * Per CLAUDE.md §0 Data Accuracy: every figure ships through Price /
 * TabularNumber. Dates render in en-US Pacific time.
 *
 * Per plan §9 Layer 4.
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
  /** D76 (DESIGN_DIRECTIVES.md) — defaults to 'all' so the timeline
   * shows every MLS event including Photo + empty FieldChange touches.
   * Pass 'meaningful-only' to filter to lifecycle events only. */
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

// MLS sync events include pure-metadata noise (Photo updates, generic
// FieldChange touches without a price delta) alongside meaningful
// lifecycle events. Surface only the lifecycle ones — buyers don't
// care that the listing got new photos at 2am.
function isMeaningfulEvent(ev: ListingHistoryEvent): boolean {
  const raw = (ev.event ?? '').toLowerCase()
  if (raw === 'photo' || raw === 'photos' || raw === 'photo_change') return false
  // FieldChange with a price delta or a substantive description is
  // a real event; otherwise it's MLS plumbing.
  if (raw === 'fieldchange' || raw === 'field_change') {
    if (ev.price_change && ev.price_change !== 0) return true
    if (ev.description && ev.description.trim().length > 8) return true
    return false
  }
  return true
}

export function PropertyHistory({ history, mode = 'all', className }: Props) {
  // Sort newest first for the timeline view. Filter only when the caller
  // explicitly asks — default 'all' surfaces every event per D76.
  const filtered = mode === 'meaningful-only' ? history.filter(isMeaningfulEvent) : history
  const events = [...filtered].sort((a, b) => {
    const ta = a.event_date ? Date.parse(a.event_date) : 0
    const tb = b.event_date ? Date.parse(b.event_date) : 0
    return tb - ta
  })
  if (events.length === 0) return null

  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>History</Eyebrow>
        <H2 className="mt-1.5">Listing history</H2>
      </div>

      <ol className="flex flex-col gap-3">
        {events.map((ev, i) => {
          const label = eventLabel(ev.event)
          const dropAmount =
            ev.price_change && ev.price_change < 0 ? Math.abs(ev.price_change) : null
          const increaseAmount =
            ev.price_change && ev.price_change > 0 ? ev.price_change : null
          return (
            <li
              key={`${i}-${ev.event}-${ev.event_date}`}
              className="flex items-start justify-between gap-4 border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-col gap-0.5">
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {formatDate(ev.event_date)}
                </div>
                {ev.description ? (
                  <Body size="small" tone="muted" className="mt-1 max-w-[60ch]">
                    {ev.description}
                  </Body>
                ) : null}
              </div>
              <div className="text-right shrink-0 flex flex-col gap-0.5">
                {ev.price ? (
                  <div className="text-sm font-semibold text-foreground">
                    <Price value={ev.price} />
                  </div>
                ) : null}
                {dropAmount ? (
                  <div className="text-xs text-destructive">
                    <TabularNumber value={dropAmount} fallback="—" />{' down'}
                  </div>
                ) : null}
                {increaseAmount ? (
                  <div className="text-xs text-foreground">
                    <TabularNumber value={increaseAmount} />{' up'}
                  </div>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </Stack>
  )
}
