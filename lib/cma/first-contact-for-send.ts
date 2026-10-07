/**
 * The facts the Review preview and the send both compose from.
 * The greeting uses a plausible first name off client_name. A trust, a
 * placeholder, or a generic word stays "Hi there,". The report itself
 * never receives that name. This helper is the email only.
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
import { CRM_BROKER_BY_EMAIL } from '@/lib/crm/constants'
import type { CmaOrigin } from '@/lib/cma/origin'

export function cmaSendBrokerSlug(email: string | null | undefined): string {
  return CRM_BROKER_BY_EMAIL[(email ?? '').trim().toLowerCase()] ?? 'matt'
}

export async function cmaFirstContactFactsForSend(
  row: Record<string, unknown>,
  extra?: {
    brokerName?: string | null
    lastListPrice?: number | null
    brokerSlug?: string | null
    personId?: number | null
    place?: FirstContactPlace | null
  },
): Promise<CmaFirstContactFacts> {
  const providedPlace = extra != null && Object.prototype.hasOwnProperty.call(extra, 'place')
  const facts = cmaFirstContactFactsFromRow(row, {
    brokerName: extra?.brokerName ?? null,
    lastListPrice: extra?.lastListPrice ?? null,
    brokerSlug: extra?.brokerSlug ?? null,
    personId: extra?.personId ?? null,
    place: providedPlace ? (extra?.place ?? null) : null,
  })
  const clientName = typeof row.client_name === 'string' ? row.client_name : null
  facts.firstName = greetingFirstName(clientName)
  if (!providedPlace) facts.place = await resolveFirstContactPlace(facts)
  return facts
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
  },
): Promise<{ facts: CmaFirstContactFacts; copy: CmaFirstContactCopy }> {
  const factsExtra: {
    brokerName?: string | null
    lastListPrice?: number | null
    brokerSlug?: string | null
    place?: FirstContactPlace | null
  } = {
    brokerName: extra.brokerName ?? null,
    lastListPrice: extra.lastListPrice ?? null,
    brokerSlug: extra.brokerSlug ?? cmaSendBrokerSlug(extra.brokerEmail),
  }
  if (Object.prototype.hasOwnProperty.call(extra, 'place')) factsExtra.place = extra.place ?? null
  const facts = await cmaFirstContactFactsForSend(row, factsExtra)
  return { facts, copy: composeCmaFirstContact(extra.origin, facts) }
}
