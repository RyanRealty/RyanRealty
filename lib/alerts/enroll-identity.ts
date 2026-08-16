/**
 * Listing-alert enrollment identity — PURE.
 *
 * sendEvent / ensureNativeLead return crm_people.id as personId. Stamp that
 * native id on listing_alerts.crm_person_id. Do not look it up through a
 * retired CRM identifier column first — post-cutover that miss left the
 * stitch null unless the email fallback happened to hit.
 */

export function nativeCrmPersonId(personId: number | null | undefined): number | null {
  if (typeof personId !== 'number' || !Number.isInteger(personId) || personId <= 0) return null
  return personId
}
