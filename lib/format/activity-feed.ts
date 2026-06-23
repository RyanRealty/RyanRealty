/**
 * Pure formatting helpers for the Contact-360 activity feed (CONTACT360 Phase 2.1).
 *
 * Lives in lib/format (alongside date.ts / money.ts) and is consumed by
 * components/admin/crm/ContactActivityFeed.tsx. Kept pure so it can be
 * unit-tested with a fixed `now`. Everything here is deterministic given
 * (ts, now) and the brand timezone (America/Los_Angeles) — no Date.now() reads
 * inside the helpers.
 */
import type { ActivityFeedItem } from '@/lib/data/crm/getContactActivityFeed'

const TZ = 'America/Los_Angeles'

/** A short relative stamp for a feed row: "just now", "12m", "3h", "5d", else a short date. */
export function relativeTime(ts: string | null | undefined, now: number): string {
  if (!ts) return ''
  const t = new Date(ts).getTime()
  if (Number.isNaN(t)) return ''
  const diffMs = now - t
  // Future-dated rows (clock skew) read as "just now" rather than a negative.
  if (diffMs < 0) return 'just now'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  // Older than a week: a short absolute date, year only when not the current year.
  const date = new Date(t)
  const sameYear = new Date(now).getFullYear() === yearInTz(date)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date)
}

/** Year of a date as seen in the brand timezone (so Dec 31 late PT doesn't roll to next year). */
function yearInTz(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric' }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  return y ? Number(y) : date.getFullYear()
}

/** A stable per-day key (YYYY-MM-DD in the brand timezone) for grouping. */
export function dayKey(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'unknown'
  // en-CA gives ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** A human day divider label: "Today", "Yesterday", or "Mon, Jun 16". */
export function dayLabel(ts: string, now: number): string {
  const key = dayKey(ts)
  if (key === 'unknown') return 'Earlier'
  const todayKey = dayKey(new Date(now).toISOString())
  const yesterdayKey = dayKey(new Date(now - 86_400_000).toISOString())
  if (key === todayKey) return 'Today'
  if (key === yesterdayKey) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(ts))
}

export type ActivityDayGroup = {
  key: string
  label: string
  items: ActivityFeedItem[]
}

/**
 * Group a newest-first feed into day buckets, preserving order. Items arrive
 * already sorted newest-first from the reader; this keeps that order both
 * across groups and within each group.
 */
export function groupByDay(items: ActivityFeedItem[], now: number): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = []
  let current: ActivityDayGroup | null = null
  for (const item of items) {
    const key = dayKey(item.ts)
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(item.ts, now), items: [] }
      groups.push(current)
    }
    current.items.push(item)
  }
  return groups
}
