/**
 * Tracked one-off HTML send — the CRM Resend rail with open pixel + signed clicks.
 * Callers never talk to Gmail or Resend directly.
 */
import 'server-only'

import { sendGovernedEmail } from '@/lib/comms/sendGovernedEmail'
import { findExistingOneOffSend } from '@/lib/data/email/one-off-send-state'
import { brokerSendIdentity } from '@/lib/email/broker-identity'
import { missingLocalImageSrcs, normalizeOneOffUtms } from '@/lib/email/one-off-html'

export type SendOneOffEmailInput = {
  personId: number
  to: string
  subject: string
  html: string
  /** Stable key, e.g. oneoff:tetherow-elize. Becomes purpose + idempotency key. */
  sendKey: string
  from?: string
  replyTo?: string
  broker?: string
}

export type SendOneOffEmailResult =
  | { ok: true; providerId?: string; emailKey: string }
  | { ok: false; error: string; stage?: string }

export function oneOffEmailKey(sendKey: string, personId: number): string {
  return `gov:${sendKey}:${personId}`
}

function displayFrom(from: string | undefined, broker: string): string {
  const identity = brokerSendIdentity(broker)
  const explicit = from?.trim()
  if (!explicit) return identity.from
  // Resend is verified on mail.ryan-realty.com. A Workspace mailbox
  // (matt@ryan-realty.com) is Reply-To, not From.
  if (/@ryan-realty\.com$/i.test(explicit.replace(/.*<|>/g, '')) && !/@mail\.ryan-realty\.com$/i.test(explicit)) {
    return identity.from
  }
  if (explicit.includes('<')) return explicit
  return identity.from
}

export async function sendOneOffEmail(input: SendOneOffEmailInput): Promise<SendOneOffEmailResult> {
  const personId = input.personId
  const sendKey = input.sendKey.trim()
  const to = input.to.trim().toLowerCase()
  const subject = input.subject.trim()
  const html = normalizeOneOffUtms(input.html)
  if (!Number.isInteger(personId) || personId <= 0) {
    return { ok: false, error: 'personId is required', stage: 'recipient' }
  }
  if (!sendKey || !to || !subject || !html) {
    return { ok: false, error: 'sendKey, to, subject, and html are required', stage: 'recipient' }
  }
  if (!sendKey.startsWith('oneoff:') && !sendKey.startsWith('one-off:')) {
    return { ok: false, error: 'sendKey must start with oneoff:', stage: 'recipient' }
  }
  const missing = missingLocalImageSrcs(html, {})
  if (missing.length) {
    return {
      ok: false,
      error: `Host local images before send: ${missing.join(', ')}`,
      stage: 'recipient',
    }
  }

  const prior = await findExistingOneOffSend({ personId, sendKey, subject })
  if (prior.emailEventId || prior.timelineId) {
    return {
      ok: false,
      error: `Already sent (event ${prior.emailEventId ?? '—'}, timeline ${prior.timelineId ?? '—'})`,
      stage: 'provider',
    }
  }

  const broker = input.broker?.trim() || 'matt'
  const identity = brokerSendIdentity(broker)
  const res = await sendGovernedEmail({
    personId,
    purpose: sendKey,
    idempotencyKey: sendKey,
    initiator: { kind: 'broker', broker, source: 'one-off' },
    payload: {
      rail: 'resend',
      to,
      subject,
      html,
      from: displayFrom(input.from, broker),
      replyTo: input.replyTo?.trim() || identity.replyTo,
      timelineTitle: subject,
    },
  })
  if (!res.ok) return { ok: false, error: res.error, stage: res.stage }
  return { ok: true, providerId: res.providerId, emailKey: oneOffEmailKey(sendKey, personId) }
}
