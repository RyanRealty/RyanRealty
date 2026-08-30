/**
 * lib/comms — the ONE governed send chokepoint (admin rebuild §A4).
 *
 * Layering: conversation layer → governed-send layer (THIS) → provider.
 * Every outbound message to a person routes through sendGovernedSms /
 * sendGovernedGroupMms / sendGovernedEmail, which enforce, IN ORDER:
 *
 *   1. hard-stop tags        (compliance:hard-stop — blocks every channel)
 *   2. channel suppression   (crm_suppressions + TAG_CHANNEL, FAIL CLOSED)
 *   3. quiet hours           (SMS only — 8pm–8am Pacific, Oregon's window)
 *   4. idempotency           (crm_idempotency_keys, existing key patterns)
 *   5. provider send         (existing rails: Twilio / Gmail DWD / Resend)
 *   6. persistence           (crm_timeline + conversation shadow-write)
 *
 * A person blocked at stage N NEVER reaches stage N+1. The guards are the
 * EXISTING canonical functions (lib/crm/suppressions, lib/crm/quiet-hours,
 * lib/crm/idempotency) — this layer composes them, it does not re-implement
 * the rules. Gate: scripts/check-governed-send.mjs (G56) ratchets direct
 * provider call-sites outside this directory toward zero.
 */

import type { CrmBrokerSlug } from '@/lib/crm/constants'
import type { CrmEmailAttachment } from '@/lib/crm/gmail'
import type { EmailBodyFormat } from '@/lib/crm/email-body'
import type { CrmAttachmentRef } from '@/lib/crm/attachment-limits'

/**
 * Who asked for this send. `broker` is the acting broker slug when a human
 * initiated it (already resolved by the caller: signed-in slug ?? the
 * contact's assigned_broker ?? 'matt'). System sends name their `source`
 * (e.g. 'sequence-engine', 'prospecting-drip').
 */
export type GovernedInitiator = {
  kind: 'broker' | 'system'
  broker?: string | null
  source?: string
}

/** Which guard (or phase) refused the send. */
export type GovernedStage =
  | 'hard-stop' // compliance:hard-stop tag — never contact, any channel
  | 'suppression' // channel suppression (rows or tags), incl. fail-closed read errors
  | 'quiet-hours' // TCPA window, SMS only
  | 'recipient' // no usable phone/email on file
  | 'provider' // the rail itself refused (Twilio/Gmail/Resend error)

export type GovernedFailure = { ok: false; error: string; stage: GovernedStage }

/** sid/to are absent on an idempotent replay short-circuit (in-flight sibling). */
export type GovernedSmsResult = { ok: true; sid?: string; to?: string } | GovernedFailure
export type GovernedEmailResult = { ok: true; providerId?: string } | GovernedFailure

export type GovernedSmsRequest = {
  personId: number
  payload: {
    /** Raw body — merge tokens (%first% etc.) are rendered inside the chokepoint. */
    body: string
    /** Short-lived signed URLs for Twilio's media fetch (MMS). */
    mediaUrls?: string[]
    /** Storage-backed refs persisted to the timeline so the thread renders media forever. */
    storedMedia?: Array<{ path: string; name: string; contentType: string }>
  }
  /** Free-form audit label, e.g. 'crm:manual-sms', 'prospecting:drip'. */
  purpose: string
  /**
   * At-most-once key. Wrapped as `sms:{personId}:{key}` (the existing pattern)
   * via withSendIdempotency. Omit when the caller already holds a whole-send
   * key (the group/broadcast composer does).
   */
  idempotencyKey?: string
  initiator: GovernedInitiator
  /** A6: only a manual, human-typed 1:1 reply may override quiet hours. */
  overrideQuietHours?: boolean
  /** crm_timeline.source — defaults to 'app'. */
  timelineSource?: string
}

export type GovernedGmailPayload = {
  rail: 'gmail'
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyText: string
  bodyFormat?: EmailBodyFormat
  attachments?: CrmEmailAttachment[]
  /** Open/click instrumentation (lib/email-tracking) — same contract as sendCrmEmail. */
  track?: { personId: number; emailKey: string; label?: string }
  /** Broker-signature append (client-facing sends). Defaults to true. */
  withSignature?: boolean
  /** Extra CRM contacts (spouse on Cc, co-buyer on To) that get their own timeline row. */
  extraPersonIds?: number[]
  /** Storage-backed attachment refs persisted in the timeline payload. */
  attachmentRefs?: CrmAttachmentRef[]
  /** Fallback conversation address when the To list is empty (primary email). */
  primaryAddress?: string | null
}

/**
 * Automated/deliverable rail: prepareDeliverableEmail (CAN-SPAM footer,
 * List-Unsubscribe, deliverability score) + Resend. For system sends — a 1:1
 * broker reply uses the gmail rail.
 */
export type GovernedResendPayload = {
  rail: 'resend'
  to: string
  subject: string
  html: string
  text?: string | null
  from?: string
  replyTo?: string
  unsubscribeUrl?: string
  attachments?: Array<{ filename: string; content: Buffer }>
  /** Timeline row title — defaults to the subject. */
  timelineTitle?: string
}

export type GovernedEmailPayload = GovernedGmailPayload | GovernedResendPayload

export type GovernedEmailRequest = {
  personId: number
  payload: GovernedEmailPayload
  /** Free-form audit label, e.g. 'crm:manual-email', 'cma:delivery'. */
  purpose: string
  /** At-most-once key. Wrapped as `email:{personId}:{key}` (the existing pattern). */
  idempotencyKey?: string
  initiator: GovernedInitiator
  /**
   * Write a `sent` email_events row after the provider accepts the mail.
   * Default true. Bulk email-cohort sets this false because it already claimed
   * the sent row before the wire (double-send safety).
   */
  recordSentEvent?: boolean
}
