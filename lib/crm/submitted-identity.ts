/**
 * Which person does a landing-page submission belong to?
 *
 * THE BUG THIS CLOSES (2026-08-25). The seller LP took the identity-bridge
 * cookie unconditionally and never compared it to the email in the form. On a
 * shared or previously-identified browser that filed one person's home and
 * seller intent onto a DIFFERENT person's record. A live walkthrough submitted
 * marketing+quinn@ with a Bend address and every artifact landed on Blake
 * (person 63425), whose only connection was an earlier form fill in the same
 * browser: seller tags, stage change, a CMA built for a house Blake does not
 * own, two "call within 5 min" tasks, and an auto-sending seller sequence. The
 * actual lead was never created.
 *
 * THE RULE. The email typed into the form NOW is the current, explicit
 * statement of identity. The cookie is a guess left over from an earlier visit.
 * So the cookie may only be used when it does not contradict the email.
 *
 * A household sharing a laptop is the ordinary case here, not an edge case.
 */

export type SubmittedIdentity = {
  /** The person to write against, or null to let the email-first create path run. */
  personId: number | null
  /** True when we resolved to an existing person rather than creating one. */
  alreadyKnown: boolean
}

export function resolveSubmittedIdentity(args: {
  /** crm_people.id from the rr_pid identity cookie, if any. */
  cookiePersonId: number | null
  /** crm_people.id the submitted email resolves to, if any. */
  emailPersonId: number | null
  /** Did the submission actually carry an email address? */
  hasEmail: boolean
}): SubmittedIdentity {
  const { cookiePersonId, emailPersonId, hasEmail } = args

  // An email that names a known person always wins, cookie or no cookie.
  if (hasEmail && emailPersonId) {
    return { personId: emailPersonId, alreadyKnown: true }
  }

  // An email for somebody we have never seen must CREATE that person. Falling
  // back to the cookie here is precisely what mis-filed Quinn onto Blake.
  if (hasEmail && !emailPersonId) {
    return { personId: null, alreadyKnown: false }
  }

  // No email: the cookie is the only identity signal we have, so use it.
  if (cookiePersonId) {
    return { personId: cookiePersonId, alreadyKnown: true }
  }

  return { personId: null, alreadyKnown: false }
}

/**
 * May an opt-in ticked in THIS submit (SMS consent, email updates) be recorded
 * against the person resolveSubmittedIdentity chose? (consent integrity, 2026-10-14)
 *
 *  - The submit carried an email: the person is the one those typed details
 *    name or create. That is first-party consent given with the form's own
 *    disclosure, and it stands.
 *  - No email: the person came from the rr_pid cookie, a guess left over from an
 *    earlier visit. It counts only when the cookie is VERIFIED (a signed link we
 *    sent them, or a confirmed sign-in, lib/identity/person-cookie.ts). A
 *    claimed cookie names whoever's email was once typed into a form on this
 *    browser; a legacy or unsigned one proves nothing at all. Recording consent
 *    for that person would let a stranger opt someone else in.
 */
export function submittedConsentCounts(args: {
  hasEmail: boolean
  /** PersonCookieRead.provenance of the rr_pid cookie, or null when there is none. */
  cookieProvenance: 'verified' | 'claimed' | 'legacy' | 'unsigned' | null
}): boolean {
  if (args.hasEmail) return true
  return args.cookieProvenance === 'verified'
}
