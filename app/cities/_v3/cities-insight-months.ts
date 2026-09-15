const CLOSE_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Unique published-month label from YYYY-MM-DD. Never two "May 2026". */
export function formatPublishedCloseMonth(periodStart: string) {
  const match = /^(\d{4})-(\d{2})/.exec(periodStart.trim())
  if (!match) return periodStart
  const month = CLOSE_MONTHS[Number(match[2]) - 1]
  return month ? `${month} ${match[1]}` : periodStart
}

/** Month + year of the close, never a liveline clock axis. */
export function formatCloseYear(t: number) {
  const d = new Date(t * 1000)
  const month = CLOSE_MONTHS[d.getUTCMonth()]
  return `${month} ${d.getUTCFullYear()}`
}
