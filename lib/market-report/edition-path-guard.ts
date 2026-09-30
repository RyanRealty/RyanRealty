/**
 * Edge guard for the monthly report's edition pages (visibility audit SEO-9,
 * the soft-404 class).
 *
 * /housing-market/reports/monthly/<YYYY-MM> renders under app/loading.tsx's
 * Suspense boundary, so a notFound() thrown in the page ships a hollow 200
 * with noindex: on production any string after /monthly/ answered 200
 * (/1999-01, /2099-01 and /not-a-month, checked 2026-09-30). The edge knows,
 * without a database, what an edition path can be: the page's own month shape
 * (edition-keys.ts parseEditionMonth), from the first edition to the month
 * before the current one, because a month's edition is built after the month
 * closes. Anything else is a real 404 at the edge. A month inside that range
 * with no published edition yet (the days before the 8th's publish, or a month
 * the gate held) stays the page's own concern. Middleware skips any path with
 * a dot unless its matcher names the route, so middleware.ts lists this one.
 */

/** The first month the archive holds (the backfill's start). */
export const FIRST_EDITION_MONTH = '2006-01'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** "January 2006": the first edition, as the edge's 404 page names it. */
export const FIRST_EDITION_LABEL = `${MONTH_NAMES[Number(FIRST_EDITION_MONTH.slice(5, 7)) - 1]} ${FIRST_EDITION_MONTH.slice(0, 4)}`

const EDITION_PATH = /^\/housing-market\/reports\/monthly\/([^/]+)\/?$/

/** 'YYYY-MM' of the month `now` falls in, in UTC. */
function monthOf(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

/** True when the path is an edition page the edge can already call a 404. */
export function isInvalidEditionPath(pathname: string, now: Date = new Date()): boolean {
  const match = EDITION_PATH.exec(pathname)
  if (!match) return false
  // The edge sees the path still percent-encoded (2026%2D08); the page sees it
  // decoded, so the guard decodes first, as the geo and blog guards do. A
  // malformed escape is no month at all.
  let key: string
  try {
    key = decodeURIComponent(match[1]!)
  } catch {
    return true
  }
  const shape = /^(\d{4})-(\d{2})$/.exec(key)
  if (!shape) return true
  const month = Number(shape[2])
  if (month < 1 || month > 12) return true
  return key < FIRST_EDITION_MONTH || key >= monthOf(now)
}
