/**
 * Retired expired / FSBO dashboard send path.
 *
 * Prospecting (`sendProspectingIntro` / `sendProspectingEmailIntro`) is the
 * only cold-outreach send. These strings are what the leftover actions return
 * so a stale button or a direct server-action call cannot text or email.
 */

export const RETIRED_PROSPECTING_SEND =
  'This send path is retired. Send from /admin/prospecting.'

export function retiredProspectingSendError(): { ok: false; error: string } {
  return { ok: false, error: RETIRED_PROSPECTING_SEND }
}

export function retiredProspectingSendDataError(): {
  data: null
  error: string
} {
  return { data: null, error: RETIRED_PROSPECTING_SEND }
}
