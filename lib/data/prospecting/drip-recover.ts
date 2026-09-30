/**
 * D. Settle first-touch email sends whose function died mid-flight.
 *
 * 2026-09-29 22:54 UTC: the drip's first real run timed out after claiming an
 * expired owner. The row stayed 'sending' with a claim_at, no message id and no
 * sent_at; no email had left. Nothing ever looked at it again: the drain picks
 * only 'queued' rows, and the hard-skip clears only 'queued' rows.
 *
 * Each drain run starts here. A claim older than DRIP_STUCK_SEND_STALE_MS with
 * no message id belongs to a function that is certainly dead. Whether its email
 * left is decided from evidence, in this order:
 *
 *   1. email_events: a 'sent' row keyed to this prospect's CMA (`cma:<slug>`)
 *      at or after the claim. The rail writes it the moment the send returns.
 *   2. Gmail Sent: a message to the owner at or after the claim, in any mailbox
 *      the rail sends from, read over DWD with gmail.readonly.
 *
 * Then:
 *   found    stamp that message id and the time it went, mark the row sent.
 *            It went out; it is never sent again.
 *   absent   release the claim. A drip member goes back to 'queued' and the
 *            next run sends it normally.
 *   unknown  leave the row exactly as it is, log one console.error and queue a
 *            broker alert. The next run asks again.
 *
 * FAIL CLOSED. "absent" needs every check to have run cleanly AND no other
 * trace of an email to that owner since the claim. A Gmail search that could
 * not run, an address that cannot be searched, or an email_events row that
 * could be this send without being a 'sent' row we can stamp (an open on the
 * CMA's key; an untracked Resend delivery to the owner, which is what a Resend
 * fallback leaves when the function dies before the rail's own 'sent' row) all
 * mean unknown. The row stays stuck rather than risk a second email.
 *
 * The two writes are fenced on the claim_at examined here (see stuck-send.ts),
 * so a claim someone took while this ran is never released or finalized.
 */

import 'server-only'

import { getProspect } from './get'
import { getCmaBrokerBySlugOrEmail } from '@/lib/data/cma/builderReads'
import { getCrmMailboxes } from '@/lib/data/brokers/directory'
import { getLatestClientReadyCmaRowForBaseSlug } from '@/lib/cma/versions'
import { findSentMessageTo, SENT_LOOKUP_SKEW_MS, type SentLookupResult } from '@/lib/crm/gmail-sent-lookup'
import { BROKER_ALERT_ORIGIN, queueBrokerHealthAlert } from '@/lib/crm/broker-alerts'
import { isInternalRecipientEmail } from '@/lib/email/internal-recipient'
import { prospectDetailHref } from './detail-href'
import { isCmaEmailKeyForBase, prospectDocBaseSlug } from './doc-slug'
import {
  finalizeRecoveredFirstTouchSend,
  listEmailEventsSince,
  listStaleFirstTouchSends,
  releaseStuckFirstTouchSend,
  type StaleFirstTouchSend,
  type StuckSendEmailEvent,
} from './stuck-send'
import type { ProspectKind } from './types'

/** The mailbox the rail falls back to, and the founding broker's. Always searched. */
const FOUNDING_MAILBOX = 'matt@ryan-realty.com'

export type StuckSendVerdict =
  | {
      verdict: 'found'
      via: 'email-events' | 'gmail-sent'
      messageId: string | null
      sentAt: string
      personId: number | null
    }
  | { verdict: 'absent' }
  | { verdict: 'unknown'; reason: string }

export type StuckSendOutcome =
  | {
      kind: ProspectKind
      id: string
      claimAt: string
      outcome: 'finalized'
      via: 'email-events' | 'gmail-sent'
      messageId: string | null
      sentAt: string
    }
  | { kind: ProspectKind; id: string; claimAt: string; outcome: 'released'; requeued: boolean }
  | { kind: ProspectKind; id: string; claimAt: string; outcome: 'unresolved'; reason: string }
  /** The row moved while it was examined (someone settled or re-claimed it); left alone. */
  | { kind: ProspectKind; id: string; claimAt: string; outcome: 'changed' }

/**
 * The decision, from gathered evidence alone (pure). `sent` is null when the
 * email_events check already decided and Gmail was never asked.
 */
export function decideStuckSend(args: {
  baseSlug: string | null
  recipients: string[]
  events: StuckSendEmailEvent[]
  sent: SentLookupResult | null
}): StuckSendVerdict {
  const recipients = new Set(args.recipients.map((r) => r.trim().toLowerCase()).filter((r) => !isInternalRecipientEmail(r)))
  const isCmaKey = (key: string | null) => typeof key === 'string' && key.startsWith('cma:')
  // A send to one of our own addresses (a harness alias, a broker test send of
  // the same CMA) is never the owner's email: counting it would mark the owner
  // sent when the owner was never emailed.
  const external = (e: StuckSendEmailEvent) => !isInternalRecipientEmail(e.recipientEmail)
  // This prospect's own document first. Then any CMA email that reached the
  // owner: the rail claims this same row when it sends a second CMA built for
  // the same house (lib/cma/prospect-send-claim.ts), whose key carries that
  // document's slug, not this prospect's. Either way the owner got a first
  // contact after the claim, and a second one must not follow.
  const sentRow =
    args.events.find((e) => e.event === 'sent' && external(e) && isCmaEmailKeyForBase(e.emailKey, args.baseSlug)) ??
    args.events.find((e) => e.event === 'sent' && isCmaKey(e.emailKey) && recipients.has(e.recipientEmail))
  if (sentRow) {
    return {
      verdict: 'found',
      via: 'email-events',
      messageId: sentRow.messageId,
      sentAt: sentRow.occurredAt,
      personId: sentRow.personId,
    }
  }
  if (args.sent?.status === 'found') {
    return {
      verdict: 'found',
      via: 'gmail-sent',
      messageId: args.sent.hit.messageId,
      sentAt: args.sent.hit.sentAt,
      personId: null,
    }
  }
  // Anything else that could be this send's trace: an event on the CMA's key
  // (an open with no sent row), a CMA-keyed event to the owner, or an event to
  // the owner no send claimed (what a Resend fallback leaves when the function
  // dies before the rail's own 'sent' row).
  const trace = args.events.find(
    (e) =>
      (isCmaEmailKeyForBase(e.emailKey, args.baseSlug) && external(e)) ||
      (recipients.has(e.recipientEmail) && (e.emailKey == null || isCmaKey(e.emailKey))),
  )
  if (trace) {
    return {
      verdict: 'unknown',
      reason: `email_events has a '${trace.event}' event ${trace.emailKey ? `on ${trace.emailKey}` : 'to the owner with no key'} since the claim, but no sent row or Sent message to stamp`,
    }
  }
  if (!args.sent) return { verdict: 'unknown', reason: 'Gmail Sent was not checked' }
  if (args.sent.status === 'unknown') {
    return { verdict: 'unknown', reason: `could not check Gmail Sent: ${args.sent.errors.join('; ')}` }
  }
  return { verdict: 'absent' }
}

function normalizedEmails(list: Array<unknown>): string[] {
  const out = new Set<string>()
  for (const v of list) {
    if (typeof v !== 'string') continue
    const e = v.trim().toLowerCase()
    if (e.includes('@')) out.add(e)
  }
  return [...out]
}

/** Every mailbox the CMA rail could have sent this from: the founding mailbox, every CRM mailbox, and the document's own broker. */
async function mailboxesToSearch(brokerSlug: string | null): Promise<string[]> {
  const boxes = [FOUNDING_MAILBOX]
  for (const mb of await getCrmMailboxes()) boxes.push(mb.email)
  if (brokerSlug) {
    const broker = await getCmaBrokerBySlugOrEmail({ slug: brokerSlug })
    const email = typeof broker?.email === 'string' ? broker.email.trim() : ''
    if (/@ryan-realty\.com$/i.test(email)) boxes.push(email)
  }
  return normalizedEmails(boxes)
}

async function examine(row: StaleFirstTouchSend): Promise<StuckSendVerdict> {
  const prospect = await getProspect(row.kind, row.id)
  if (!prospect) return { verdict: 'unknown', reason: 'the prospect record could not be read' }

  const baseSlug = prospectDocBaseSlug(prospect)
  const clientReady = baseSlug ? await getLatestClientReadyCmaRowForBaseSlug(baseSlug) : null
  const cmaRow = (clientReady?.row ?? null) as Record<string, unknown> | null
  // Our own addresses are never the owner, and Gmail Sent is full of them.
  const recipients = normalizedEmails([row.contactEmail, prospect.contactEmail, cmaRow?.client_email]).filter(
    (email) => !isInternalRecipientEmail(email),
  )
  if (recipients.length === 0) {
    return { verdict: 'unknown', reason: 'no owner email address on the prospect or its CMA to check against' }
  }

  const since = new Date(Date.parse(row.claimAt) - SENT_LOOKUP_SKEW_MS)
  const events = await listEmailEventsSince({ recipients, cmaBaseSlug: baseSlug, sinceIso: since.toISOString() })
  const fromEvents = decideStuckSend({ baseSlug, recipients, events, sent: null })
  if (fromEvents.verdict === 'found') return fromEvents

  const brokerSlug = typeof cmaRow?.broker_slug === 'string' ? cmaRow.broker_slug : null
  const sent = await findSentMessageTo({
    mailboxes: await mailboxesToSearch(brokerSlug),
    recipients,
    since: new Date(row.claimAt),
  })
  return decideStuckSend({ baseSlug, recipients, events, sent })
}

function stuckAlertBody(row: StaleFirstTouchSend, reason: string): string {
  return [
    `First-touch email stuck mid-send: ${row.streetAddress ?? row.id}.`,
    `Claimed ${row.claimAt}. The drip cannot tell whether it went out (${reason.slice(0, 220)}), so it will not send it again. It checks every minute.`,
    `View: ${BROKER_ALERT_ORIGIN}${prospectDetailHref(row.kind, row.id)}`,
  ].join('\n')
}

async function leaveStuck(row: StaleFirstTouchSend, reason: string): Promise<StuckSendOutcome> {
  console.error('[prospecting] drip stuck send left in place (cannot prove whether it left):', {
    kind: row.kind,
    id: row.id,
    claimAt: row.claimAt,
    reason,
  })
  // Deduped per row by the helper's cooldown, so a row that stays stuck pages
  // Matt once per window, not once a minute.
  await queueBrokerHealthAlert({
    key: `drip-stuck-send:${row.kind}:${row.id}`,
    body: stuckAlertBody(row, reason),
  }).catch(() => false)
  return { kind: row.kind, id: row.id, claimAt: row.claimAt, outcome: 'unresolved', reason }
}

async function settle(row: StaleFirstTouchSend): Promise<StuckSendOutcome> {
  const base = { kind: row.kind, id: row.id, claimAt: row.claimAt }
  let verdict: StuckSendVerdict
  try {
    verdict = await examine(row)
  } catch (e) {
    verdict = { verdict: 'unknown', reason: `the check failed: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (verdict.verdict === 'unknown') return leaveStuck(row, verdict.reason)

  try {
    if (verdict.verdict === 'found') {
      const wrote = await finalizeRecoveredFirstTouchSend({
        kind: row.kind,
        id: row.id,
        claimAt: row.claimAt,
        messageId: verdict.messageId,
        sentAt: verdict.sentAt,
        personId: verdict.personId,
      })
      if (!wrote) return { ...base, outcome: 'changed' }
      console.warn('[prospecting] drip stuck send finalized (the email had left):', {
        ...base,
        via: verdict.via,
        messageId: verdict.messageId,
        sentAt: verdict.sentAt,
      })
      return { ...base, outcome: 'finalized', via: verdict.via, messageId: verdict.messageId, sentAt: verdict.sentAt }
    }

    const wrote = await releaseStuckFirstTouchSend({
      kind: row.kind,
      id: row.id,
      claimAt: row.claimAt,
      queuedAt: row.queuedAt,
    })
    if (!wrote) return { ...base, outcome: 'changed' }
    console.warn('[prospecting] drip stuck send released (no email left):', { ...base, requeued: row.queuedAt != null })
    return { ...base, outcome: 'released', requeued: row.queuedAt != null }
  } catch (e) {
    return leaveStuck(row, `the ${verdict.verdict === 'found' ? 'finalize' : 'release'} write failed: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Stale claims examined per drain run. Each can cost a few Gmail calls. */
export const MAX_STUCK_SENDS_PER_RUN = 3

/**
 * Which stale claims this run examines (pure). A claim the recovery cannot
 * settle stays stale, so "the oldest N" would pin the same rows forever and a
 * newer stuck send behind them would never be looked at (or alerted on).
 * Rotate instead: the page moves once a minute, so every stale claim is
 * examined at least once every ceil(count / perRun) minutes.
 */
export function pickStuckSendsForRun<T>(rows: readonly T[], now: Date, perRun: number = MAX_STUCK_SENDS_PER_RUN): T[] {
  if (rows.length <= perRun) return [...rows]
  const pages = Math.ceil(rows.length / perRun)
  const page = Math.floor(now.getTime() / 60_000) % pages
  return rows.slice(page * perRun, page * perRun + perRun)
}

/**
 * Examine this run's share of the stale claims and settle what the evidence
 * allows. Throws only when the stale-row read itself fails, so the drain fails
 * closed; a failure on one row leaves that row stuck and alerts.
 */
export async function recoverStuckFirstTouchSends(now: Date = new Date()): Promise<StuckSendOutcome[]> {
  const stale = await listStaleFirstTouchSends(now)
  const outcomes: StuckSendOutcome[] = []
  for (const row of pickStuckSendsForRun(stale, now)) outcomes.push(await settle(row))
  return outcomes
}
