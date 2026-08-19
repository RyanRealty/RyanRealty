/**
 * Pure helpers for "text ME this CMA" — broker-to-self only.
 *
 * Destination is resolved from the acting broker's cell (TWILIO_FORWARD_* /
 * brokers.forward_to_cell). The CMA client_phone / lead number is never a
 * send target. That is the class that would have texted the household.
 */

import { isBrokerPhone, last10, toE164 } from '@/lib/crm/alert-drain-core'

export function cmaBrokerReviewUrl(slug: string): string {
  const safe = String(slug ?? '').trim().toLowerCase()
  return `https://ryan-realty.com/admin/cmas/${safe}`
}

export function cmaBrokerSelfTextBody(params: {
  slug: string
  subjectAddress: string | null
}): string {
  const slug = String(params.slug ?? '').trim().toLowerCase()
  const address = (params.subjectAddress ?? '').trim() || slug
  return [`CMA draft ready — ${address}`, `Review (broker only): ${cmaBrokerReviewUrl(slug)}`].join('\n')
}

export function resolveBrokerSelfPhone(params: {
  broker: string
  phonesByBroker: Record<string, string | undefined>
  whitelist: Set<string>
}): { ok: true; to: string } | { ok: false; error: string } {
  const broker = (params.broker || 'matt').trim() || 'matt'
  const raw = params.phonesByBroker[broker] ?? params.phonesByBroker.matt
  if (!raw) return { ok: false, error: 'Your broker cell is not configured.' }
  if (!isBrokerPhone(raw, params.whitelist)) {
    return { ok: false, error: 'Broker cell is not on the internal whitelist.' }
  }
  return { ok: true, to: toE164(raw) }
}

/** True when `to` is one of the CMA/client numbers and is NOT a broker line. */
export function isNonBrokerClientDestination(
  to: string,
  clientPhones: Array<string | null | undefined>,
  whitelist: Set<string>,
): boolean {
  if (isBrokerPhone(to, whitelist)) return false
  const dest = last10(to)
  if (dest.length !== 10) return false
  return clientPhones.some((p) => last10(p) === dest)
}

export function refuseIfClientDestination(params: {
  to: string
  clientPhones: Array<string | null | undefined>
  whitelist: Set<string>
}): { ok: true } | { ok: false; error: string } {
  if (isNonBrokerClientDestination(params.to, params.clientPhones, params.whitelist)) {
    return { ok: false, error: 'Refused: that number is the client, not a broker line.' }
  }
  if (!isBrokerPhone(params.to, params.whitelist)) {
    return { ok: false, error: 'Refused: destination is not a broker line.' }
  }
  return { ok: true }
}

export function collectCmaClientPhones(row: {
  client_phone?: unknown
  clientPhone?: unknown
}): Array<string | null> {
  return [typeof row.client_phone === 'string' ? row.client_phone : null, typeof row.clientPhone === 'string' ? row.clientPhone : null]
}
