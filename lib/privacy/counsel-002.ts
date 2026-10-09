/**
 * Privacy copy from Counsel memo 002, section 4 (2026-10-08).
 * The page prints these strings. [contact email] is the address /privacy
 * already prints, passed in by the caller.
 */

export const PRIVACY_OTHER_SOURCES =
  'We also get information from other sources: public property records (such as owner names and mailing addresses), the multiple listing service, and data providers that supply contact details such as phone numbers and email addresses. We combine this with what you give us.'

/** The click-id paragraph from memo section 4, item 2. */
export const PRIVACY_CLICK_ID_ENDING =
  'That tells us which of our ads, emails and posts are working. If we already know who you are, for example because you clicked a link we sent you, we connect this to your contact record. If you decline cookies, or your browser sends a Global Privacy Control signal, we record nothing at all.'

export const PRIVACY_CLICK_ID_OPENING =
  'Whatever you choose, we record how each visit reached us in our own first-party logs: the page you came from and any campaign tag or click id on the link you clicked (utm_*, gclid, fbclid).'

export function privacyClickIdParagraph(): string {
  return `${PRIVACY_CLICK_ID_OPENING} ${PRIVACY_CLICK_ID_ENDING}`
}

export const PRIVACY_MILESTONE =
  'When a client relationship reaches a milestone, such as a signed listing, a pending sale or a closing, we may tell Meta and Google that the milestone happened, using the same one-way hashed email or phone, and for a closing, the commission we earned. This lets them measure which ads led to real business. We never send them your raw email or phone, your sale price, or details of your transaction documents.'

export function privacyOptOutSentence(contactEmail: string): string {
  return `To opt out across our systems, email us at ${contactEmail} with the subject line Do Not Sell or Share, or use the Stop ad matching link in any of our emails. Within 15 days we will remove you from our advertising audiences and stop sending your hashed identifiers, including for ad measurement.`
}

/** The browser sentences that stay beside the memo's cross-system opt-out. */
export const PRIVACY_OPT_OUT_BROWSER =
  'To opt out on this browser, set Marketing to off in our cookie banner. That stops the Meta Pixel and advertising cookies here.'

export const PRIVACY_OPT_OUT_TAIL =
  'Opting out does not stop the essential or analytics functions you have allowed.'

export function privacyDoNotSellOptOut(contactEmail: string): string {
  return `${PRIVACY_OPT_OUT_BROWSER} ${privacyOptOutSentence(contactEmail)} ${PRIVACY_OPT_OUT_TAIL}`
}
