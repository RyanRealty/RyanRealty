/**
 * Auto-instrument lead-facing HTML at the send chokepoint.
 *
 * Brokers never opt into tracking. A caller that forgets `personId` still gets
 * an open pixel + click wrap when the To address maps to exactly one CRM
 * person. Already-instrumented HTML (`/api/track/e/`) is a no-op so bulk and
 * pre-attributed paths stay cheap. Internal broker mailboxes are skipped so
 * digests and ops alerts do not pick up a lead pixel.
 */
import { BROKERS, CONTACT } from '@/lib/brand/contact'

const INTERNAL_MAILBOXES = new Set<string>([
  ...Object.values(BROKERS).map((b) => b.email.toLowerCase()),
  CONTACT.email.primary.toLowerCase(),
])

export function isInternalOutboundRecipient(email: string): boolean {
  const n = email.trim().toLowerCase()
  if (!n) return false
  if (INTERNAL_MAILBOXES.has(n)) return true
  const env = [process.env.ADMIN_EMAIL, process.env.RESEND_ADMIN_EMAIL]
  return env.some((e) => (e ?? '').trim().toLowerCase() === n)
}

export async function resolveTrackablePersonId(email: string): Promise<number | null> {
  try {
    if (isInternalOutboundRecipient(email)) return null
    const { getPersonIdsByEmail } = await import('@/lib/data/crm/getPersonIdsByEmail')
    const ids = await getPersonIdsByEmail(email)
    return ids.length === 1 ? ids[0] : null
  } catch {
    return null
  }
}

export async function instrumentLeadHtml(
  html: string,
  opts: {
    to: string | string[]
    subject: string
    personId?: number
    emailKey?: string
    brokerSlug?: string
  },
): Promise<string> {
  if (!html || html.includes('/api/track/e/')) return html
  let personId =
    typeof opts.personId === 'number' && Number.isInteger(opts.personId) && opts.personId > 0
      ? opts.personId
      : null
  if (personId == null) {
    const toList = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((s) => s.trim()).filter(Boolean)
    if (toList.length !== 1) return html
    personId = await resolveTrackablePersonId(toList[0])
  }
  if (personId == null) return html
  const { attributeOutbound } = await import('@/lib/crm/attributed-links')
  return attributeOutbound(html, {
    brokerSlug: opts.brokerSlug ?? '',
    personId,
    emailKey: opts.emailKey ?? `outbound:${personId}`,
    label: opts.subject,
    broker: opts.brokerSlug,
  })
}
