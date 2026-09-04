/**
 * Prospect ↔ CRM person link for send/enroll paint.
 *
 * A non-null outreach_crm_person_id is not enough: farm stubs (Pine Vista /
 * John Arzner class) can be linked with empty emails[] + phones[] while the
 * expired row still carries skip-trace contact points. Channel paint then looks
 * email-open and classify would SEND — but compose/CRM has no real contact.
 * Treat contactless CRM rows as unlinked so list+detail paint Link contact
 * (owner-attach), same as personId == null.
 */

export function crmPersonHasOutboundContact(
  person: { emails?: unknown; phones?: unknown } | null | undefined,
): boolean {
  if (!person) return false
  const emails = Array.isArray(person.emails) ? person.emails : []
  const phones = Array.isArray(person.phones) ? person.phones : []
  return emails.length > 0 || phones.length > 0
}

/** personId that satisfies the send/enroll person gate; null when unlinked or contactless. */
export function effectiveProspectPersonId(
  personId: number | null,
  person: { emails?: unknown; phones?: unknown } | null | undefined,
): number | null {
  if (personId == null) return null
  return crmPersonHasOutboundContact(person) ? personId : null
}
