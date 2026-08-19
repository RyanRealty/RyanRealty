/**
 * Buyer-facing tour confirmation. Name the listing when the contact
 * page already resolved one. Founding case: flow-prover on /contact?intent=tour
 * confirmed a tour without saying which home.
 */

export function publishTourConfirmation(listingSummary?: string | null): string {
  const named = listingSummary?.trim()
  if (named) {
    return `Tour request received for ${named}. A broker will call or text to confirm a time within one business day.`
  }
  return 'Tour request received. A broker will call or text to confirm a time within one business day.'
}
