/**
 * "Text me this CMA" — auth + destination + send orchestration.
 * The server action is a thin wrapper so unauthorized / client-leak
 * cases stay unit-testable without a session.
 */

import {
  clientPhonesFromCmaRow,
  sendCmaReviewLinkToBroker,
} from '@/lib/crm/broker-self-sms'

export async function runTextCmaReviewLinkToMe(params: {
  authorized: boolean
  broker: string | null
  slug: string
  loadRow: (slug: string) => Promise<Record<string, unknown> | null>
}): Promise<{ error: string | null }> {
  if (!params.authorized) return { error: 'Unauthorized' }
  const slug = String(params.slug ?? '').trim().toLowerCase()
  if (!slug) return { error: 'Missing CMA.' }
  const row = await params.loadRow(slug)
  if (!row) return { error: 'CMA not found' }
  return sendCmaReviewLinkToBroker({
    slug,
    subjectAddress: typeof row.subject_address === 'string' ? row.subject_address : null,
    broker: params.broker ?? 'matt',
    clientPhones: clientPhonesFromCmaRow(row),
  })
}
