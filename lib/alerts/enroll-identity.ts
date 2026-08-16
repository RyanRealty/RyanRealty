/**
 * Listing-alert enrollment identity — PURE.
 *
 * sendEvent / ensureNativeLead return crm_people.id as personId. Enrollment
 * writers used to pass that value as fubPersonId, and resolveCrmPersonId
 * looked up fub_legacy_id first. Post-cutover that miss left crm_person_id
 * null unless the email JSONB fallback happened to hit. This helper is the
 * contract: a capture personId is a native CRM id.
 */

export function nativeCrmPersonId(personId: number | null | undefined): number | null {
  if (typeof personId !== 'number' || !Number.isInteger(personId) || personId <= 0) return null
  return personId
}
