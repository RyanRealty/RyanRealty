/**
 * From / Reply-To / signature defaults for a CRM batch email.
 *
 * Lead-facing cohort sends used to ride Resend's bare RESEND_FROM (a noreply
 * local-part on mail.ryan-realty.com) with no signature. Two failures:
 *
 *   1. Replies vanished — Reply-To was whatever the worker happened to freeze,
 *      and the From line itself was a mailbox nobody reads, so clients who
 *      reply-to-sender never reached the broker.
 *   2. The 1:1 composer already appends the Gmail-matched signature
 *      (lib/crm/email-signature.ts). The batch dialog passed signatureHtml=null
 *      and the worker never appended it, so Preview / test send / the real
 *      cohort were all missing the block Gmail already has.
 *
 * Identity is derived from the signed-in actor, never from a client-supplied
 * From string (a crafted POST must not pick an arbitrary sender).
 */
import { BROKERS, type BrokerKey } from '@/lib/brand/contact'
import { brokerSendIdentity } from '@/lib/email/broker-identity'

export type BulkEmailSendVia = 'resend' | 'gmail'

export type FrozenBulkEmailSend = {
  /** Default on. The worker appends getSignatureForMailbox(actor) when true. */
  includeSignature: boolean
  sendVia: BulkEmailSendVia
  /** RFC 5322 From for the Resend rail. Unused when sendVia is gmail. */
  fromIdentity: string
  /** Real, monitored mailbox. Always the actor's broker mailbox. */
  replyTo: string
}

/** Workspace daily send cap is about 2,000. Warn before a list that size. */
export const GMAIL_SEND_WARN_AT = 400
export const GMAIL_SEND_DAILY_CAP = 1800

export function canSendFromMailbox(email: string): boolean {
  const wanted = email.trim().toLowerCase()
  return Object.values(BROKERS).some((b) => b.email.toLowerCase() === wanted)
}

export function brokerSlugFromActorEmail(email: string): BrokerKey {
  const wanted = email.trim().toLowerCase()
  const hit = (Object.entries(BROKERS) as Array<[BrokerKey, (typeof BROKERS)[BrokerKey]]>).find(
    ([, b]) => b.email.toLowerCase() === wanted,
  )
  return hit?.[0] ?? 'matt'
}

/** Visible From caption, e.g. `Matt Ryan · Ryan Realty`. */
export function displayNameFromIdentity(from: string): string {
  const quoted = from.match(/^"([^"]+)"/)
  if (quoted?.[1]) return quoted[1]
  const bare = from.match(/^([^<]+)</)
  if (bare?.[1]?.trim()) return bare[1].trim()
  return from.trim()
}

/**
 * Freeze the send identity at enqueue / test / schedule time so the worker,
 * the test copy, and the preview all agree. `includeSignature` defaults ON.
 * An explicit `sendVia: 'gmail'` from a non-mailbox login falls back to resend
 * rather than forging a From the actor cannot own.
 */
export function freezeBulkEmailSendParams(
  actorEmail: string,
  input: { includeSignature?: boolean | null; sendVia?: string | null } = {},
): FrozenBulkEmailSend {
  const identity = brokerSendIdentity(actorEmail)
  const wantGmail = input.sendVia === 'gmail' && canSendFromMailbox(actorEmail)
  const sendVia: BulkEmailSendVia = wantGmail ? 'gmail' : 'resend'
  return {
    includeSignature: input.includeSignature !== false,
    sendVia,
    fromIdentity: sendVia === 'gmail' ? actorEmail.trim().toLowerCase() : identity.from,
    replyTo: identity.replyTo,
  }
}
