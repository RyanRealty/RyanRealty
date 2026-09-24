/**
 * Twilio line health — pure decisions over what Twilio itself reports, so the
 * CRM pages on a broken line instead of on a quiet day.
 *
 * Two facts live only in Twilio, and both were invisible to the CRM until
 * 2026-09-24:
 *
 *  1. A recipient's opt-out state. Twilio's default opt-out handling honors a
 *     STOP-family keyword texted to a sender and refuses every later message
 *     with error 21610 until a START-family keyword arrives. The refusal comes
 *     back asynchronously, after the create call succeeded, so a drain that
 *     marks "sent" on create reports delivery that never happened. Matt's cell
 *     texted "Stop" to the marketing line on 2026-09-13 18:26Z; the next 411
 *     broker alerts (health alarms, lead alerts, task digests) all failed 21610
 *     while crm_broker_alerts said "sent".
 *  2. Whether the inbound webhook is being delivered. Silence cannot tell a
 *     broken webhook from a quiet week (real gaps between inbound texts and
 *     calls run 91 to 167 hours), so the old "no inbound in 6h" rule paged Matt
 *     twice a day while the webhook was healthy. Twilio logs every failed
 *     webhook delivery as a Monitor alert (11200 family) and holds the webhook
 *     URL each number points at; those are the signals.
 */

/** Twilio's default opt-out keywords (whole body, case-insensitive). */
export const OPT_OUT_KEYWORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'optout', 'revoke'])
/** Twilio's default opt-in keywords. */
export const OPT_IN_KEYWORDS = new Set(['start', 'yes', 'unstop'])

export interface InboundKeywordMessage {
  body: string | null | undefined
  /** Any Date-parsable timestamp (Twilio's RFC 2822 date_created works). */
  dateCreated: string
}

export type OptOutState = { optedOut: false } | { optedOut: true; since: string }

/**
 * A recipient's opt-out state toward one sender, from the messages that
 * recipient sent to that sender. The latest keyword wins, exactly as Twilio
 * applies it; a message that is not a keyword changes nothing.
 */
export function optOutStateFromInbound(messages: InboundKeywordMessage[]): OptOutState {
  const sorted = [...messages].sort((a, b) => Date.parse(b.dateCreated) - Date.parse(a.dateCreated))
  for (const m of sorted) {
    const word = (m.body ?? '').trim().replace(/[.!]+$/, '').toLowerCase()
    if (OPT_IN_KEYWORDS.has(word)) return { optedOut: false }
    if (OPT_OUT_KEYWORDS.has(word)) return { optedOut: true, since: new Date(Date.parse(m.dateCreated)).toISOString() }
  }
  return { optedOut: false }
}

/**
 * Twilio error codes that mean a webhook to us was not delivered or not
 * understood: 11200-11299 (HTTP retrieval: timeout, 4xx/5xx, bad TLS, bad
 * content type) and 12100-12399 (the TwiML we returned did not parse).
 */
export function isWebhookErrorCode(code: number | string | null | undefined): boolean {
  const n = Number(code)
  if (!Number.isInteger(n)) return false
  return (n >= 11200 && n <= 11299) || (n >= 12100 && n <= 12399)
}

export interface TwilioNumberRouting {
  phoneNumber: string
  smsUrl: string | null
  voiceUrl: string | null
}

/**
 * Numbers whose inbound SMS or voice webhook no longer points at our own
 * /api/twilio routes on `origin`. An empty list means every line routes to us.
 */
export function misroutedNumbers(numbers: TwilioNumberRouting[], origin: string): string[] {
  const base = `${origin.replace(/\/+$/, '')}/api/twilio/`
  const ok = (u: string | null) => typeof u === 'string' && u.startsWith(base)
  return numbers.filter((n) => !ok(n.smsUrl) || !ok(n.voiceUrl)).map((n) => n.phoneNumber)
}
