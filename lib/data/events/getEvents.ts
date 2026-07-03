/**
 * getEvents — the Central Oregon events registry, shaped for the hub page and
 * the newsletter.
 *
 * Pure registry read (data/co-events.ts) — no DB query. The hub lists every
 * recurring anchor event: the ones with a confirmed upcoming date first (in
 * date order), then the annual anchors whose next occurrence is not yet
 * published (in name order). All data is verified + cited — nothing invented
 * (CLAUDE.md §0).
 *
 * Lives behind the DAL boundary so pages import from @/lib/data only (Gate G8).
 */

import { CO_EVENTS, type CoEvent, type EventCategory } from '@/data/co-events'

export type EventsIndex = {
  /** Events with a confirmed upcoming (or in-progress) date, soonest first. */
  upcoming: CoEvent[]
  /** Recurring anchors whose next date the organizer has not yet published. */
  anchors: CoEvent[]
}

export type EventCategoryGroup = { category: EventCategory; events: CoEvent[] }

/** Today's date as an ISO 'YYYY-MM-DD' string, in local (Pacific) reckoning. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** An event is still upcoming/current when its end (or start) date is >= today. */
function isCurrentOrFuture(e: CoEvent, today: string): boolean {
  const last = e.endDate ?? e.nextConfirmedDate
  return last != null && last >= today
}

/**
 * The registry split for the hub: confirmed-upcoming (soonest first) then
 * date-pending anchors (by name). Past-dated rows are excluded from `upcoming`
 * and fall through to `anchors` only if they have no date at all — a past
 * `nextConfirmedDate` is a CI failure (check-content-freshness), so this is a
 * safety net, not the normal path.
 */
export function getEventsForIndex(): EventsIndex {
  const today = todayIso()

  const upcoming = CO_EVENTS.filter((e) => isCurrentOrFuture(e, today)).sort((a, b) =>
    (a.nextConfirmedDate ?? '9999').localeCompare(b.nextConfirmedDate ?? '9999'),
  )

  const upcomingSlugs = new Set(upcoming.map((e) => e.slug))
  const anchors = CO_EVENTS.filter((e) => !upcomingSlugs.has(e.slug)).sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  return { upcoming, anchors }
}

/** Total count of events in the registry (for the hub intro). */
export function getEventsCount(): number {
  return CO_EVENTS.length
}

/** Display order for the hub's category sections. */
const CATEGORY_ORDER: EventCategory[] = [
  'festival',
  'music',
  'arts',
  'food-drink',
  'market',
  'race',
  'sports',
  'community',
  'seasonal',
]

/**
 * Every event grouped by category, in a stable display order — for the hub's
 * browsable sections. Within a category, confirmed-dated events sort first (by
 * date), then recurrence-only anchors by name.
 */
export function getEventsByCategory(): EventCategoryGroup[] {
  const byDateThenName = (a: CoEvent, b: CoEvent) =>
    (a.nextConfirmedDate ?? '9999').localeCompare(b.nextConfirmedDate ?? '9999') ||
    a.name.localeCompare(b.name)

  return CATEGORY_ORDER.map((category) => ({
    category,
    events: CO_EVENTS.filter((e) => e.category === category).sort(byDateThenName),
  })).filter((g) => g.events.length > 0)
}

/**
 * Events whose confirmed date falls within a given calendar month — the read
 * surface the monthly newsletter's "This Month in Central Oregon" section
 * consumes (docs/plans/HANDOFF-newsletter.md). Returns [] when nothing is
 * confirmed for that month; the newsletter degrades gracefully.
 *
 * @param year  4-digit year, e.g. 2026
 * @param month 1-based month (1 = January)
 */
export function getEventsForMonth(year: number, month: number): CoEvent[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return CO_EVENTS.filter((e) => {
    const start = e.nextConfirmedDate
    if (!start) return false
    // Event overlaps the month if it starts in it, or spans across it.
    const end = e.endDate ?? start
    return start.startsWith(prefix) || (start <= `${prefix}-31` && end >= `${prefix}-01`)
  }).sort((a, b) => (a.nextConfirmedDate ?? '').localeCompare(b.nextConfirmedDate ?? ''))
}
