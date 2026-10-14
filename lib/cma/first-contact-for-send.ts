/**
 * The facts the Review preview and the send both compose from.
 * The greeting uses a plausible first name off client_name, checked against
 * the email the letter goes to (Matt 2026-10-14, 429 Irving: "Hi Margo," in
 * David's inbox). A trust, a placeholder, a generic word, or an email that
 * belongs to a co-owner the stored name is not stays "Hi there," or moves to
 * the co-owner the email names (lib/crm/household-names.ts). The report
 * itself never receives that name. This helper is the email only.
 */
import 'server-only'
import {
  cmaFirstContactFactsFromRow,
  composeCmaFirstContact,
  greetingFirstName,
  type CmaFirstContactCopy,
  type CmaFirstContactFacts,
} from '@/lib/cma/first-contact'
import { resolveFirstContactPlace, type FirstContactPlace } from '@/lib/cma/first-contact-place'
import { resolveOwnerOfRecordForCma } from '@/lib/cma/owner-of-record'
import { chooseGreetingForEmail } from '@/lib/crm/household-names'
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import { getPersonForCmaKickoff } from '@/lib/data/crm/cmaKickoff'
import type { CmaOrigin } from '@/lib/cma/origin'

export function cmaSendBrokerSlug(email: string | null | undefined): string {
  return CRM_BROKER_BY_EMAIL[(email ?? '').trim().toLowerCase()] ?? 'matt'
}

type FactsExtra = {
  brokerName?: string | null
  lastListPrice?: number | null
  brokerSlug?: string | null
  personId?: number | null
  place?: FirstContactPlace | null
  /** The address the letter goes to. Defaults to the row's client_email. */
  greetingEmail?: string | null
  /** The county owner string. Omit to read it off the linked expired row. */
  ownerOfRecord?: string | null
}

function has(extra: FactsExtra | undefined, key: keyof FactsExtra): boolean {
  return extra != null && Object.prototype.hasOwnProperty.call(extra, key)
}

export async function cmaFirstContactFactsForSend(
  row: Record<string, unknown>,
  extra?: FactsExtra,
): Promise<CmaFirstContactFacts> {
  const providedPlace = has(extra, 'place')
  const facts = cmaFirstContactFactsFromRow(row, {
    brokerName: extra?.brokerName ?? null,
    lastListPrice: extra?.lastListPrice ?? null,
    brokerSlug: extra?.brokerSlug ?? null,
    personId: extra?.personId ?? null,
    place: providedPlace ? (extra?.place ?? null) : null,
  })
  const clientName = typeof row.client_name === 'string' ? row.client_name : null
  // The address the letter goes to: the send's resolved recipient when the
  // caller has it, else the column, else the linked person's primary email
  // (read only; the send stamps it when it fills the column), so the Review
  // preview and the send greet the same person.
  const email = has(extra, 'greetingEmail') ? (extra?.greetingEmail ?? null) : await greetingEmailOf(row)
  const ownerPromise: Promise<string | null> = has(extra, 'ownerOfRecord')
    ? Promise.resolve(extra?.ownerOfRecord ?? null)
    : email
      ? resolveOwnerOfRecordForCma(row).catch(() => null)
      : Promise.resolve(null)
  const placePromise = providedPlace ? Promise.resolve(facts.place) : resolveFirstContactPlace(facts)
  const [ownerOfRecord, place] = await Promise.all([ownerPromise, placePromise])
  facts.firstName = chooseGreetingForEmail({
    baseFirstName: greetingFirstName(clientName),
    clientName,
    email,
    ownerOfRecord,
  }).firstName
  facts.place = place
  return facts
}

async function greetingEmailOf(row: Record<string, unknown>): Promise<string | null> {
  const column = typeof row.client_email === 'string' ? row.client_email.trim().toLowerCase() : ''
  if (column) return column
  const personId = typeof row.person_id === 'number' ? row.person_id : Number(row.person_id)
  if (!Number.isFinite(personId) || personId <= 0) return null
  const person = await getPersonForCmaKickoff(personId).catch(() => null)
  return person?.primaryEmail?.trim().toLowerCase() || null
}

/** What the Review page shows, and what send composes for the same row. */
export async function buildCmaFirstContactForRow(
  row: Record<string, unknown>,
  extra: {
    origin: CmaOrigin
    brokerName?: string | null
    brokerEmail?: string | null
    brokerSlug?: string | null
    lastListPrice?: number | null
    place?: FirstContactPlace | null
    greetingEmail?: string | null
    ownerOfRecord?: string | null
  },
): Promise<{ facts: CmaFirstContactFacts; copy: CmaFirstContactCopy }> {
  const factsExtra: FactsExtra = {
    brokerName: extra.brokerName ?? null,
    lastListPrice: extra.lastListPrice ?? null,
    brokerSlug: extra.brokerSlug ?? cmaSendBrokerSlug(extra.brokerEmail),
  }
  if (Object.prototype.hasOwnProperty.call(extra, 'place')) factsExtra.place = extra.place ?? null
  if (Object.prototype.hasOwnProperty.call(extra, 'greetingEmail')) factsExtra.greetingEmail = extra.greetingEmail ?? null
  if (Object.prototype.hasOwnProperty.call(extra, 'ownerOfRecord')) factsExtra.ownerOfRecord = extra.ownerOfRecord ?? null
  const facts = await cmaFirstContactFactsForSend(row, factsExtra)
  return { facts, copy: composeCmaFirstContact(extra.origin, facts) }
}
