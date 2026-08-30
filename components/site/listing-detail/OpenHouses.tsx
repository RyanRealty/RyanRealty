import { publishOpenHouseDay } from '@/lib/listing/publish-calendar-day'

/**
 * Listing-detail OpenHouses — upcoming open-house events for THIS
 * listing only (the homepage's `OpenHousesGrid` is a different
 * component covering open houses across the brokerage).
 *
 * Reads from the `open_houses` table joined to the listing key. Empty
 * list = nothing renders.
 *
 * Per CLAUDE.md §0 brand voice: time ranges use a hyphen, not en-dash.
 * Day names render in en-US Pacific time.
 *
 * Per plan §9 Layer 4.
 */

export type ListingOpenHouse = {
  open_house_key?: string
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  notes?: string | null
}

type Props = {
  events: ReadonlyArray<ListingOpenHouse>
  className?: string
}

function formatDay(iso: string | null | undefined): string {
  return publishOpenHouseDay(iso)
}

function formatClock(hms: string | null | undefined): string {
  if (!hms) return ''
  const [h, m] = hms.split(':').map((x) => parseInt(x, 10))
  if (Number.isNaN(h)) return hms
  const period = h >= 12 ? 'pm' : 'am'
  const hr = h % 12 === 0 ? 12 : h % 12
  const min = m && m !== 0 ? `:${m.toString().padStart(2, '0')}` : ''
  return `${hr}${min}${period}`
}

function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = formatClock(start)
  const b = formatClock(end)
  if (a && b) return `${a}-${b}`
  return a || b
}

export function OpenHouses({ events, className }: Props) {
  if (events.length === 0) return null

  const upcoming = [...events]
    .filter((e) => !!e.event_date)
    .sort((a, b) => Date.parse(a.event_date as string) - Date.parse(b.event_date as string))

  if (upcoming.length === 0) return null

  return (
    <section className={className}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Visit</div>
          <h2 className="sec-title">Open houses</h2>
        </div>
      </div>
      <ul className="listing-ledger">
        {upcoming.map((e, i) => {
          const range = formatRange(e.start_time, e.end_time)
          return (
            <li key={e.open_house_key ?? `${i}-${e.event_date}`}>
              <span>
                {formatDay(e.event_date)}
                {range ? ` · ${range}` : ''}
              </span>
              {e.notes ? <span>{e.notes}</span> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
