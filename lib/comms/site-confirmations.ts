/**
 * site-confirmations — the same-minute "we got it" for the three site submits
 * that had none (SITE-09, Matt 2026-09-07).
 *
 * THE RULE THIS SITS UNDER. "A same-minute confirmation to a visitor who just
 * submitted their own request is a system confirmation, not a broker send"
 * (CLAUDE.md §1, Matt 2026-09-07). So these do not wait for approval and they do
 * not pretend to be the broker writing: every one goes through sendGovernedEmail
 * with `initiator.kind: 'system'`, which the rails now stamp into the timeline
 * row so the response clock can tell it apart from a human answering
 * (lib/crm/response-clock.ts).
 *
 * WHAT THEY MAY SAY. Only what is true at the moment they send. The broker alert
 * is queued in the same request and the drain runs every minute, so "right away"
 * is honest and "within five minutes" would be a promise nobody wrote down. No
 * figures live here at all: the place-page confirmation carries the verdict and
 * the comp count because that page computed them (lib/cma/request-emails.ts);
 * the contact form, the alert captures and the expired LP compute nothing, so
 * they claim nothing (§0).
 *
 * Transport copied from sendPlaceValueConfirmation: the Gmail rail, the assigned
 * broker's own mailbox with their signature appended, an idempotency key per
 * submit. A visitor with no CRM person gets no confirmation — there is nobody to
 * check the consent record against, and the chokepoint is keyed on a person.
 */

import 'server-only'
import { sendGovernedEmail } from '@/lib/comms/sendGovernedEmail'
import { resolveSigningBrokerForPerson } from '@/lib/data/cma/signing-broker'

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export type SiteConfirmationResult = {
  ok: boolean
  via: 'gmail' | 'skipped' | 'refused' | 'failed'
  error?: string
}

type Signer = { firstName: string; crmSlug: string; bookHref: string }

/**
 * Who signs, and where the visitor books. The lead's assigned broker, Matt as
 * the fallback — the same resolver the CMA and the place-page confirmation use,
 * so a visitor never hears from two different people about one submit.
 */
async function resolveSigner(personId: number): Promise<Signer> {
  const broker = await resolveSigningBrokerForPerson(personId).catch(() => null)
  const crmSlug = broker?.crmSlug ?? 'matt'
  const firstName = (broker?.displayName ?? 'Matt Ryan').trim().split(/\s+/)[0] || 'Matt'
  return { firstName, crmSlug, bookHref: `${SITE_ORIGIN}/book?agent=${encodeURIComponent(crmSlug)}` }
}

function greet(firstName?: string | null): string {
  const f = firstName?.trim().split(/\s+/)[0]
  return f ? `Hi ${f},` : 'Hi there,'
}

async function send(args: {
  personId: number
  to: string
  purpose: string
  idempotencyKey: string
  source: string
  broker: string
  subject: string
  bodyText: string
}): Promise<SiteConfirmationResult> {
  const res = await sendGovernedEmail({
    personId: args.personId,
    purpose: args.purpose,
    idempotencyKey: args.idempotencyKey,
    initiator: { kind: 'system', broker: args.broker, source: args.source },
    payload: {
      rail: 'gmail',
      to: [args.to],
      subject: args.subject,
      bodyText: args.bodyText,
      withSignature: true,
      track: {
        personId: args.personId,
        emailKey: `${args.purpose}:${args.personId}`,
        label: args.subject,
        broker: args.broker,
      },
    },
  })
  if (res.ok) return { ok: true, via: 'gmail' }
  return { ok: false, via: res.stage === 'provider' ? 'failed' : 'refused', error: `${res.stage}: ${res.error}` }
}

/**
 * /contact, including every listing "request a tour" and "ask a question" CTA
 * (they land here with ?listingKey=). No figures: this form asks for none.
 */
export async function sendContactConfirmation(params: {
  personId: number | null
  leadEmail: string
  firstName?: string | null
  inquiryType: string
  /** "123 NW Franklin Ave, Bend (MLS 220…)" when the visitor came from a listing. */
  listingLabel?: string | null
  isTour?: boolean
}): Promise<SiteConfirmationResult> {
  if (params.personId == null) return { ok: false, via: 'skipped', error: 'no crm person for the lead' }
  const signer = await resolveSigner(params.personId)
  const about = params.listingLabel?.trim()

  const subject = params.isTour
    ? `Your tour request${about ? ` for ${about}` : ''}`
    : about
      ? `We got your note about ${about}`
      : 'We got your note'

  const opening = about
    ? params.isTour
      ? `Thanks for asking to see ${about}. We have your request.`
      : `Thanks for writing about ${about}. We have your note.`
    : `Thanks for writing. We have your note${params.inquiryType ? ` about ${params.inquiryType.toLowerCase()}` : ''}.`

  const bodyText = [
    greet(params.firstName),
    '',
    opening,
    '',
    `${signer.firstName} gets it right away and will answer you personally.`,
    '',
    `If you would rather just talk, pick a time that works: ${signer.bookHref}`,
    '',
    'Anything else we should know, just reply to this email.',
  ].join('\n')

  return send({
    personId: params.personId,
    to: params.leadEmail,
    purpose: 'contact:confirmation',
    idempotencyKey: `contact:${params.personId}:${about ? about.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'general'}`,
    source: 'contact-form',
    broker: signer.crmSlug,
    subject,
    bodyText,
  })
}

/**
 * The guest saved-search and saved-home captures.
 *
 * The two are not the same promise and the copy must not pretend they are. A
 * saved SEARCH writes a listing_alerts row the cron emails on
 * (upsertListingAlert), so "one email per new match" is a fact. A saved HOME
 * writes no alert at all — submitListingSaveCapture captures the lead and the
 * saved-home state stays behind sign-in — so that variant promises a broker, not
 * a feed.
 */
export async function sendAlertConfirmation(params: {
  personId: number | null
  leadEmail: string
  firstName?: string | null
  kind: 'search' | 'listing'
  /** Search: the filters in plain words. Listing: the street line. */
  criteriaSummary?: string | null
}): Promise<SiteConfirmationResult> {
  if (params.personId == null) return { ok: false, via: 'skipped', error: 'no crm person for the lead' }
  const signer = await resolveSigner(params.personId)
  const what = params.criteriaSummary?.trim()

  if (params.kind === 'search') {
    const bodyText = [
      greet(params.firstName),
      '',
      what
        ? `Your listing alert is on: ${what}.`
        : 'Your listing alert is on.',
      '',
      'When a home comes on the market that matches, you get one email about that home. Nothing else, and you can stop it from any of them.',
      '',
      `${signer.firstName} knows you are watching and can tell you what the numbers behind a place look like before you drive out to it. Pick a time whenever you want one: ${signer.bookHref}`,
      '',
      'Reply here to change what we watch for.',
    ].join('\n')

    return send({
      personId: params.personId,
      to: params.leadEmail,
      purpose: 'alert:confirmation',
      idempotencyKey: `alert-search:${params.personId}:${(what ?? 'any').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
      source: 'search-alert',
      broker: signer.crmSlug,
      subject: what ? `Your alert is on: ${what}` : 'Your listing alert is on',
      bodyText,
    })
  }

  const home = what || 'that home'
  const bodyText = [
    greet(params.firstName),
    '',
    `We have ${home} saved for you.`,
    '',
    `${signer.firstName} sees it right away. If you want to walk it, or want to know what comparable homes actually closed at first, say the word.`,
    '',
    `Pick a time: ${signer.bookHref}`,
    '',
    'Reply here with what else you are looking for and we will keep an eye out.',
  ].join('\n')

  return send({
    personId: params.personId,
    to: params.leadEmail,
    purpose: 'alert:confirmation',
    idempotencyKey: `alert-listing:${params.personId}:${home.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
    source: 'listing-save',
    broker: signer.crmSlug,
    subject: `${home} is saved`,
    bodyText,
  })
}

/**
 * /lp/expired-listing.
 *
 * Deliberately thin: no verdict, no figure, no report. The CMA the submit queues
 * still carries notifyLead:false ("the owner never asked us for a report",
 * app/lp/expired-listing/actions.ts), and this acknowledges the submit itself so
 * an owner is not left wondering whether the form worked.
 */
export async function sendExpiredAcknowledgment(params: {
  personId: number | null
  leadEmail: string
  firstName?: string | null
  address?: string | null
}): Promise<SiteConfirmationResult> {
  if (params.personId == null) return { ok: false, via: 'skipped', error: 'no crm person for the lead' }
  const signer = await resolveSigner(params.personId)
  const address = params.address?.trim()

  const bodyText = [
    greet(params.firstName),
    '',
    `We got your request${address ? ` about ${address}` : ''}.`,
    '',
    `${signer.firstName} gets it right away and will reach out personally to talk through what happened and what we would do differently.`,
    '',
    `If you would rather pick the time yourself, here is the calendar: ${signer.bookHref}`,
  ].join('\n')

  return send({
    personId: params.personId,
    to: params.leadEmail,
    purpose: 'expired:acknowledgment',
    idempotencyKey: `expired-ack:${params.personId}:${(address ?? 'no-address').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
    source: 'expired-lp',
    broker: signer.crmSlug,
    subject: address ? `We got your note about ${address}` : 'We got your note',
    bodyText,
  })
}
