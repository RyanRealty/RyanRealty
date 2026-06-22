/**
 * Canonical date/timezone formatting (audit p1.4).
 *
 * ~96 files format dates inline and ~30 hardcode an `America/...` timezone. This
 * is the single source; default zone is America/Los_Angeles (Central Oregon).
 * The `ci:date-format` gate ratchets new inline date formatting toward zero.
 */
const TZ = 'America/Los_Angeles'

/** Format a date in the brand timezone. Defaults to "Jun 22, 2026"; override via opts. */
export function formatDate(
  d: string | number | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (d == null) return '—'
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  }).format(date)
}

/** Date + time in the brand timezone, e.g. "Jun 22, 2026, 3:04 PM". */
export function formatDateTime(d: string | number | Date | null | undefined): string {
  return formatDate(d, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
