/**
 * The producer marker on a monthly market report email draft:
 * newsletters.created_by = 'cron:market-report-edition:<YYYY-MM>'.
 *
 * No admin form edits created_by (the subject can change), so it is the key
 * for "this month's email": one per month (unique index, migration
 * 20260930130000), found again by the daily backstop, and canceled rather than
 * deleted when Matt deletes it, so a skipped month stays skipped
 * (deleteNewsletterDraft). Pure, so the newsletter DAL can import it.
 */
export const EDITION_EMAIL_MARKER_PREFIX = 'cron:market-report-edition:'

export function editionEmailMarker(month: string): string {
  return `${EDITION_EMAIL_MARKER_PREFIX}${month.slice(0, 7)}`
}

export function isEditionEmailMarker(createdBy: string | null | undefined): boolean {
  return typeof createdBy === 'string' && createdBy.startsWith(EDITION_EMAIL_MARKER_PREFIX)
}

/** 'YYYY-MM' from a marker, or null. */
export function editionEmailMonth(createdBy: string | null | undefined): string | null {
  if (!isEditionEmailMarker(createdBy)) return null
  const month = createdBy!.slice(EDITION_EMAIL_MARKER_PREFIX.length)
  return /^\d{4}-\d{2}$/.test(month) ? month : null
}
