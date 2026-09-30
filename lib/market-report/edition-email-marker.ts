/**
 * The keys of a monthly market report email: its producer marker and the
 * edition build its figures came from.
 *
 * The marker: newsletters.created_by = 'cron:market-report-edition:<YYYY-MM>'.
 * No admin form edits created_by (the subject can change), so it is the key
 * for "this month's email": one live row per month (unique index, migration
 * 20260930130000), found again by the daily backstop, and canceled rather than
 * deleted when Matt deletes it, so a skipped month stays skipped
 * (deleteNewsletterDraft). An email replaced because its report was
 * republished with new figures keeps the marker with ':replaced:<its id>'
 * appended, which frees the live one for the replacement.
 *
 * The build: an edition's generated_at, when that version of the report was
 * built (upsertEdition). Every citation in the email carries it as fetched_at.
 *
 * Pure, so the newsletter DAL can import it.
 */
export const EDITION_EMAIL_MARKER_PREFIX = 'cron:market-report-edition:'

const REPLACED = ':replaced:'
const MARKER = /^cron:market-report-edition:(\d{4}-\d{2})(?::replaced:.+)?$/

export function editionEmailMarker(month: string): string {
  return `${EDITION_EMAIL_MARKER_PREFIX}${month.slice(0, 7)}`
}

/** The marker a replaced email keeps: unique per row, and no longer the month's live one. */
export function replacedEditionEmailMarker(month: string, id: string): string {
  return `${editionEmailMarker(month)}${REPLACED}${id}`
}

/** A monthly report email, live or replaced. */
export function isEditionEmailMarker(createdBy: string | null | undefined): boolean {
  return typeof createdBy === 'string' && createdBy.startsWith(EDITION_EMAIL_MARKER_PREFIX)
}

/** The month's live email (not one that was replaced). */
export function isLiveEditionEmailMarker(createdBy: string | null | undefined): boolean {
  return isEditionEmailMarker(createdBy) && !createdBy!.includes(REPLACED)
}

/** 'YYYY-MM' from a live or replaced marker, or null. */
export function editionEmailMonth(createdBy: string | null | undefined): string | null {
  if (typeof createdBy !== 'string') return null
  return MARKER.exec(createdBy)?.[1] ?? null
}

/** The build an edition's figures came from, as the ISO instant every citation records. */
export function editionBuildStamp(edition: { generated_at: string }): string {
  const at = Date.parse(edition.generated_at)
  return Number.isFinite(at) ? new Date(at).toISOString() : edition.generated_at
}

/** True when a trace stamped `stamp` was built from `build` or a newer edition. */
export function builtFromOrAfter(stamp: string | null | undefined, build: string): boolean {
  if (!stamp) return false
  const a = Date.parse(stamp)
  const b = Date.parse(build)
  return Number.isFinite(a) && Number.isFinite(b) && a >= b
}
