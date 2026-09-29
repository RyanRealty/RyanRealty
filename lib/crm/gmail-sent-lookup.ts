/**
 * Did a Ryan Realty mailbox send anything to this address after this moment?
 *
 * The read-only half of "did the email leave": it searches each mailbox's Sent
 * folder over Google domain-wide delegation with gmail.readonly, the same
 * client and scope lib/crm/gmail-bounce-watch.ts reads mailboxes with. It never
 * sends, drafts or modifies anything.
 *
 * Three answers, and the difference between the last two is the point:
 *   found    a message to the address, sent at or after `since` (minus a skew
 *            margin), in some mailbox: the earliest one
 *   absent   EVERY (mailbox, address) search ran cleanly and none found one
 *   unknown  nothing found, but at least one search could not run (no Gmail
 *            client, an API error, an address the query cannot carry safely).
 *            That is not proof of absence, and a caller that would resend on
 *            "absent" must treat it as "do not resend".
 *
 * Every Gmail call has a short deadline and no retry: a stalled lookup fails
 * this run and the caller asks again on its next one, instead of holding a
 * cron past its time limit.
 */

import 'server-only'

import type { gmail_v1 } from 'googleapis'
import { getGmailFor } from '@/lib/crm/gmail'

const READONLY = ['https://www.googleapis.com/auth/gmail.readonly']

/** Deadline for each Gmail request in a lookup. */
export const GMAIL_SENT_LOOKUP_TIMEOUT_MS = 15_000

/**
 * Searched this far before `since`. The claim stamp is Postgres time and the
 * Sent stamp is Google's; searching a little earlier can only turn up more
 * messages, which is the safe direction when "absent" leads to a resend.
 */
export const SENT_LOOKUP_SKEW_MS = 60_000

/** Messages read per (mailbox, address) search. One hit decides "found". */
const MAX_MESSAGES_PER_SEARCH = 10

/**
 * Addresses the query can carry unquoted. Anything outside this shape (quotes,
 * spaces, parentheses) could change what Gmail searches for, so it is reported
 * as a search that could not run rather than guessed at.
 */
const SEARCHABLE_ADDRESS = /^[a-z0-9._+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/

export type SentMessageHit = {
  mailbox: string
  recipient: string
  /** Gmail message id in the sending mailbox (the id messages.send returned). */
  messageId: string
  threadId: string | null
  /** When the mailbox sent it (Gmail internalDate), ISO. */
  sentAt: string
}

export type SentLookupResult =
  | { status: 'found'; hit: SentMessageHit }
  | { status: 'absent'; searched: number }
  | { status: 'unknown'; errors: string[] }

/**
 * The Gmail query for one address. `after:` takes epoch seconds for an exact
 * instant (a bare date would be read as midnight Pacific).
 */
export function sentSearchQuery(recipient: string, since: Date): string {
  const afterSec = Math.floor((since.getTime() - SENT_LOOKUP_SKEW_MS) / 1000)
  return `in:sent to:${recipient} after:${afterSec}`
}

function normalize(list: Array<string | null | undefined>): string[] {
  return [...new Set(list.map((s) => (s ?? '').trim().toLowerCase()).filter(Boolean))]
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function findSentMessageTo(args: {
  mailboxes: Array<string | null | undefined>
  recipients: Array<string | null | undefined>
  since: Date
  /** Injected in tests. Defaults to the DWD read-only client. */
  getGmail?: (mailbox: string) => gmail_v1.Gmail | null
}): Promise<SentLookupResult> {
  const mailboxes = normalize(args.mailboxes)
  const recipients = normalize(args.recipients)
  if (mailboxes.length === 0) return { status: 'unknown', errors: ['no mailbox to search'] }
  if (recipients.length === 0) return { status: 'unknown', errors: ['no recipient address to search for'] }
  if (!Number.isFinite(args.since.getTime())) return { status: 'unknown', errors: ['no valid claim time to search from'] }

  const getGmail = args.getGmail ?? ((mailbox: string) => getGmailFor(mailbox, READONLY))
  const floorMs = args.since.getTime() - SENT_LOOKUP_SKEW_MS
  const callOpts = { timeout: GMAIL_SENT_LOOKUP_TIMEOUT_MS, retry: false }
  const errors: string[] = []
  const hits: SentMessageHit[] = []

  await Promise.all(
    mailboxes.map(async (mailbox) => {
      let gmail: gmail_v1.Gmail | null
      try {
        gmail = getGmail(mailbox)
      } catch (e) {
        errors.push(`${mailbox}: ${errorText(e)}`)
        return
      }
      if (!gmail) {
        errors.push(`${mailbox}: no Gmail client (service account missing)`)
        return
      }
      for (const recipient of recipients) {
        if (!SEARCHABLE_ADDRESS.test(recipient)) {
          errors.push(`${mailbox}: the address on file cannot be searched safely`)
          continue
        }
        try {
          const listed = await gmail.users.messages.list(
            {
              userId: 'me',
              q: sentSearchQuery(recipient, args.since),
              maxResults: MAX_MESSAGES_PER_SEARCH,
              // A sent message the broker has since deleted still proves it left.
              includeSpamTrash: true,
            },
            callOpts,
          )
          const ids = (listed.data.messages ?? [])
            .map((m) => m.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
          // In parallel, so one search costs at most two deadlines. allSettled:
          // every read finishes (and records its hit or its error) before this
          // search is counted.
          const reads = await Promise.allSettled(
            ids.map(async (id) => {
              const got = await gmail.users.messages.get({ userId: 'me', id, format: 'minimal' }, callOpts)
              // Number(null) is 0 (1970), which would read as "before the claim":
              // a missing stamp must stay missing.
              const rawDate = got.data.internalDate
              const sentMs = typeof rawDate === 'string' && rawDate.trim() !== '' ? Number(rawDate) : Number.NaN
              if (!Number.isFinite(sentMs)) {
                // Gmail matched it but will not say when it went: it cannot be ruled out.
                errors.push(`${mailbox}: message ${id} has no send time`)
                return
              }
              if (sentMs < floorMs) return
              hits.push({
                mailbox,
                recipient,
                messageId: got.data.id ?? id,
                threadId: got.data.threadId ?? null,
                sentAt: new Date(sentMs).toISOString(),
              })
            }),
          )
          for (const r of reads) {
            if (r.status === 'rejected') errors.push(`${mailbox}: ${errorText(r.reason)}`)
          }
        } catch (e) {
          errors.push(`${mailbox}: ${errorText(e)}`)
        }
      }
    }),
  )

  if (hits.length > 0) {
    hits.sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    return { status: 'found', hit: hits[0] }
  }
  if (errors.length > 0) return { status: 'unknown', errors }
  return { status: 'absent', searched: mailboxes.length * recipients.length }
}
