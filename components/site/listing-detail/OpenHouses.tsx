import { Eyebrow, H2, Stack } from '@/components/site/primitives'

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
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Los_Angeles',
    })
  } catch {
    return iso
  }
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
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Visit</Eyebrow>
        <H2 className="mt-1.5">Open houses</H2>
      </div>
      <ul className="flex flex-col gap-3">
        {upcoming.map((e, i) => {
          const range = formatRange(e.start_time, e.end_time)
          return (
            <li
              key={e.open_house_key ?? `${i}-${e.event_date}`}
              className="flex items-baseline gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0"
            >
              <span className="text-sm font-semibold text-foreground">
                {formatDay(e.event_date)}
              </span>
              {range ? (
                <span className="text-sm text-muted-foreground tabular-nums">{range}</span>
              ) : null}
              {e.notes ? (
                <span className="text-xs text-muted-foreground ml-auto truncate max-w-[24ch]">
                  {e.notes}
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Stack>
  )
}
