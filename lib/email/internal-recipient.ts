/**
 * Is this address one of our own?
 *
 * An address on the brokerage's own domain (a broker mailbox, a
 * `marketing+name@` test alias, the `placeholder.` pseudo-domain) is never a
 * real owner. A CMA sent to one is a test or a preview, so it must never mark
 * a real prospect as emailed, and it must never be blocked because a real
 * prospect already was.
 *
 * Pure, no imports: the CMA send path and the prospect-stamp backfill both
 * decide with it, so the two can never disagree about what an internal send is.
 *
 * Not the same question as `isInternalOutboundRecipient` in
 * lib/email/auto-track.ts, which lists the broker mailboxes only so tracking
 * pixels skip them. That list misses `marketing+dana@ryan-realty.com`, and
 * that is exactly the alias the harness sends test CMAs to.
 */
const OWN_DOMAIN = /@(?:[a-z0-9-]+\.)*ryan-realty\.com$/i

export function isInternalRecipientEmail(email: string | null | undefined): boolean {
  const normalized = (email ?? '').trim().toLowerCase()
  return normalized.length > 0 && OWN_DOMAIN.test(normalized)
}
