import 'server-only'

/**
 * A sent CMA that gets engagement is a LEAD SIGNAL. Route it to the broker.
 *
 * Matt 2026-09-07: "getting these things looking good and approved and then
 * sent out and TRACKED so that we can get LEADS is the goal." Every hop of the
 * measurement already worked — opens, clicks and document views have been
 * landing in three tables for months — and none of it reached a phone. A
 * document a seller opened twice looked exactly like one nobody read.
 *
 * Two events, one alert each, both through the EXISTING rail
 * (queueBrokerAlert, the same one queueCmaReadyAlert uses), so the broker's
 * category switches, quiet window, daily cap and push fallback all apply
 * unchanged:
 *
 *   REPLY   kind `reply:cma:<slug>`         -> category 'reply'        (New leads switch)
 *   OPEN    kind `return-visit:cma:<slug>`  -> category 'return_visit' (Return visit switch)
 *
 * The kind PREFIXES are load-bearing, not cosmetic: categoryForAlertKind maps
 * on them, and an unrecognised prefix falls through to 'other', which is
 * deliberately UNGATED. A new alert that ignored the broker's switches would be
 * a preference screen lying about what it controls — the exact bug
 * lib/crm/broker-notify-prefs.ts was written to close.
 *
 * Dedupe: queueBrokerAlert's own crm_timeline gate is `alert:<kind>:<personId>`
 * and the kind carries the slug, so each document can produce exactly one open
 * alert and one reply alert for that contact, ever. "One per CMA, never
 * repeated" is therefore enforced by the rail, not by a timer here.
 *
 * FAIL CLOSED ON A MISSING PERSON. No contact, no alert — never a text about an
 * anonymous someone, and never a default-desk page for a row we cannot name.
 * Every function returns false rather than throwing: these run inside a Twilio
 * webhook, a Gmail sync and a tracking beacon.
 */

import { BROKER_ALERT_ORIGIN, queueBrokerAlert } from '@/lib/crm/broker-alerts'
import {
  findLatestSentCmaForPerson,
  findSentCmaBySlug,
  getAlertPerson,
  recordCmaRepliedEvent,
} from '@/lib/data/cma/engagementAlerts'

/** What produced the open — the wording changes, the alert does not. */
export type CmaOpenTrigger = 'email' | 'document'

/** `reply:` is what categoryForAlertKind maps to the 'reply' category. */
export function cmaReplyAlertKind(slug: string): string {
  return `reply:cma:${slug}`
}

/** `return-visit:` is what maps to the 'return_visit' category. */
export function cmaOpenAlertKind(slug: string): string {
  return `return-visit:cma:${slug}`
}

/** Two lines: what happened, then the labelled link (Matt 2026-08-25). */
export function cmaReplyAlertBody(address: string, personId: number): string {
  return [`Reply on ${address} CMA`, `View lead: ${BROKER_ALERT_ORIGIN}/admin/people/${personId}`].join('\n')
}

export function cmaOpenAlertBody(params: {
  name: string | null
  address: string
  personId: number
  trigger: CmaOpenTrigger
}): string {
  const who = params.name?.trim() || 'Someone'
  const what =
    params.trigger === 'document'
      ? `${who} opened the ${params.address} report`
      : `${who} opened your ${params.address} email`
  return [what, `View lead: ${BROKER_ALERT_ORIGIN}/admin/people/${params.personId}`].join('\n')
}

/**
 * A contact answered. If they are sitting on a CMA we sent, stamp the document
 * and tell the broker which address the conversation is about.
 *
 * Additive to handleInboundReply's generic "they replied" nudge: that one says
 * a person answered, this one says WHICH LISTING they answered about, which is
 * the difference between a callback and a callback with the number in hand.
 */
export async function routeCmaReplyToBroker(input: {
  personId: number
  channel: 'email' | 'sms' | 'call'
  /** Broker slug that owns the contact; the person's own desk wins when unset. */
  broker?: string | null
}): Promise<boolean> {
  const personId = Number(input.personId)
  if (!Number.isFinite(personId) || personId <= 0) return false

  const person = await getAlertPerson(personId)
  if (!person) return false // fail closed: no contact, no alert
  if (person.isBrokerMailbox) return false

  const cma = await findLatestSentCmaForPerson(personId)
  if (!cma) return false

  const broker = (input.broker ?? person.assignedBroker) ?? null
  await recordCmaRepliedEvent({
    personId,
    cmaId: cma.id,
    slug: cma.slug,
    subjectAddress: cma.subjectAddress,
    channel: input.channel,
    broker,
  })

  return queueBrokerAlert({
    broker,
    personId,
    kind: cmaReplyAlertKind(cma.slug),
    body: cmaReplyAlertBody(cma.subjectAddress, personId),
  })
}

/**
 * They opened it. One alert per document per contact, ever.
 *
 * `crmPersonId` is optional because the two call sites know different things:
 * the email pixel signs the recipient into its token, while a document visit
 * only knows the slug and whichever contact the visitor session is stitched to.
 * When neither supplies one we fall back to the contact the document was SENT
 * to — and if there is no contact at all, nothing is sent.
 */
export async function queueCmaOpenedAlert(input: {
  slug: string
  crmPersonId?: number | null
  trigger: CmaOpenTrigger
}): Promise<boolean> {
  const cma = await findSentCmaBySlug(input.slug)
  if (!cma) return false // never sent, or no such document

  const candidate = Number(input.crmPersonId ?? cma.personId ?? 0)
  if (!Number.isFinite(candidate) || candidate <= 0) return false

  const person = await getAlertPerson(candidate)
  if (!person) return false // fail closed
  if (person.isBrokerMailbox) return false

  return queueBrokerAlert({
    broker: person.assignedBroker,
    personId: candidate,
    kind: cmaOpenAlertKind(cma.slug),
    body: cmaOpenAlertBody({
      name: person.name,
      address: cma.subjectAddress,
      personId: candidate,
      trigger: input.trigger,
    }),
  })
}

/** `/cma/<slug>` out of a tracked page url. Null when the url is not a document. */
export function cmaSlugFromDocumentUrl(pageUrl: string | null | undefined): string | null {
  const m = String(pageUrl ?? '').match(/\/cma\/([a-z0-9-]{3,80})/i)
  return m ? m[1]!.toLowerCase() : null
}

/** `cma:<slug>` out of a tracking token's emailKey. Null for any other send. */
export function cmaSlugFromEmailKey(emailKey: string | null | undefined): string | null {
  const k = String(emailKey ?? '').trim().toLowerCase()
  if (!k.startsWith('cma:')) return null
  const slug = k.slice(4)
  return /^[a-z0-9-]{3,80}$/.test(slug) ? slug : null
}
