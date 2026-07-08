/**
 * Plain-English relative time — "2 days ago", "3 hours ago", "just now".
 *
 * Lives in lib/format (alongside date.ts / activity-feed.ts) per the
 * ci:date-format convention. Pure and deterministic given (iso, nowMs) so it is
 * unit-testable and hydration-safe when the caller supplies a stable `now`
 * (or gates on mount, like components/admin/crm/subscriptions/delivery-shared).
 *
 * Longer-form than activity-feed's relativeTime ("3h") on purpose: the delivery
 * surfaces speak broker language ("2 days ago"), with the absolute timestamp on
 * hover via the Tooltip component.
 */

/** "just now" / "5 minutes ago" / "2 days ago" / "3 months ago". */
export function agoLabel(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diffMs = nowMs - t
  // Future-dated rows (clock skew) read as "just now" rather than a negative.
  if (diffMs < 60_000) return 'just now'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return mins === 1 ? '1 minute ago' : `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days < 31) return days === 1 ? 'yesterday' : `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? 'about a month ago' : `about ${months} months ago`
  const years = Math.floor(days / 365)
  return years <= 1 ? 'about a year ago' : `about ${years} years ago`
}

/** "in 3 days" / "today" / "overdue" — for next-expected-send outlooks. */
export function untilLabel(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diffMs = t - nowMs
  if (diffMs <= 0) return 'due now'
  const days = Math.ceil(diffMs / 86_400_000)
  if (days === 1) return 'tomorrow'
  if (days < 31) return `in ${days} days`
  const months = Math.round(days / 30)
  return months <= 1 ? 'in about a month' : `in about ${months} months`
}

/** Whole days since an ISO instant (floored at 0). Used for broker-language copy. */
export function daysSince(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}
