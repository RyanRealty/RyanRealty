/**
 * Which CRM timeline kind a Gmail message is for one person on it.
 *
 *   email_in   the person sent it
 *   email_out  one of our brokers sent it, to the person
 *   email_cc   someone else sent it and the person was on it ("Copied on an
 *              email", Matt 2026-10-02): a title company's closing email that
 *              copies our client is not a broker touching that client
 *
 * The sync wrote every To/Cc person as `email_out`, so 174 of the latest 400
 * Gmail `email_out` rows (2026-10-01) were outside senders' mail, and each
 * counted as a broker touch in lib/crm/response-clock.ts. `email_cc` is in no
 * human-touch, conversation or inbox kind list. Pure.
 */
import { isHouseAddress } from '@/lib/tc/mail-rules'

export type GmailTimelineKind = 'email_in' | 'email_out' | 'email_cc'

/**
 * One of our brokers sent it: the mailbox holds it as SENT (a send-as alias
 * included), or its From is ours (our domains, Matt's own Gmail alias).
 */
export function sentByUs(input: { labelIds?: readonly (string | null | undefined)[] | null; from: readonly string[] }): boolean {
  if ((input.labelIds ?? []).includes('SENT')) return true
  return input.from.length > 0 && input.from.some((a) => isHouseAddress(a))
}

export function gmailTimelineKind(input: { personIsSender: boolean; sentByUs: boolean }): GmailTimelineKind {
  if (input.personIsSender) return 'email_in'
  return input.sentByUs ? 'email_out' : 'email_cc'
}
