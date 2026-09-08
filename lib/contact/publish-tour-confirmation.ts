/**
 * Buyer-facing tour confirmation. Name the listing when the contact
 * page already resolved one. Founding case: flow-prover on /contact?intent=tour
 * confirmed a tour without saying which home.
 */

export function publishTourConfirmation(listingSummary?: string | null): string {
  const named = listingSummary?.trim()
  // SITE-09: the duration promise is gone. The submit queues the broker's text
  // in the same request and the alert drain runs every minute, so "now" is what
  // actually happens and "within one business day" was the outer bound of a
  // slower system. No number: nobody wrote a five-minute promise to a visitor.
  if (named) {
    return `Tour request received for ${named}. A broker gets it now and will call or text to set a time.`
  }
  return 'Tour request received. A broker gets it now and will call or text to set a time.'
}
