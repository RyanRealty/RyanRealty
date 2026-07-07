import 'server-only'
import { createServiceClient } from '@/lib/data/client'

/**
 * DAL reads for the pixel/click → newsletter ledger hook (spec §5/H1) and the
 * per-issue unsubscribe metric. The open/click tracking token carries the
 * recipient's crm person id + emailKey (`newsletter:<id>`) but NOT the email, so
 * the /api/track/e routes resolve the recipient here before writing the deduped
 * ledger row.
 */

const SUBS = 'newsletter_subscribers'
const RECIPIENTS = 'newsletter_recipients'

export type LedgerRecipientContext = {
  subscriber_id: string | null
  email: string
  broker: string | null
}

/**
 * Resolve the newsletter_recipients row for (newsletter, person): find the
 * person's subscriber rows, then the recipient row for this issue. Falls back
 * to the subscriber row alone (subscriber enrolled + linked but the recipient
 * row is missing, e.g. a test send) so the ledger event is never dropped when
 * we can still attribute an email. Returns null when the person has no
 * subscriber row at all.
 */
export async function getRecipientForPerson(
  newsletterId: string,
  personId: number,
): Promise<LedgerRecipientContext | null> {
  const sb = createServiceClient()
  const { data: subs } = await sb
    .from(SUBS)
    .select('id, email')
    .eq('crm_person_id', personId)
    .limit(10)
  const subRows = (subs ?? []) as Array<{ id: string; email: string }>
  if (subRows.length === 0) return null

  const emails = subRows.map((s) => (s.email || '').toLowerCase()).filter(Boolean)
  if (emails.length > 0) {
    const { data: rec } = await sb
      .from(RECIPIENTS)
      .select('subscriber_id, email, broker')
      .eq('newsletter_id', newsletterId)
      .in('email', emails)
      .limit(1)
      .maybeSingle()
    if (rec) {
      const r = rec as { subscriber_id: string | null; email: string; broker: string | null }
      return { subscriber_id: r.subscriber_id, email: r.email, broker: r.broker }
    }
  }

  const first = subRows[0]
  return { subscriber_id: first.id, email: (first.email || '').toLowerCase(), broker: null }
}

/**
 * Recipients of this issue whose subscriber has since unsubscribed — the
 * per-issue "unsubs" metric. Issue-scoped opt-outs aren't recorded anywhere
 * else (the unsubscribe token is subscriber-scoped), so "recipients of this
 * send now unsubscribed" is the honest measurable.
 */
export async function countUnsubscribedRecipients(newsletterId: string): Promise<number> {
  const sb = createServiceClient()
  const { data: recRows } = await sb
    .from(RECIPIENTS)
    .select('subscriber_id')
    .eq('newsletter_id', newsletterId)
    .not('subscriber_id', 'is', null)
    .limit(20000)
  const ids = [...new Set(((recRows ?? []) as Array<{ subscriber_id: string }>).map((r) => r.subscriber_id))]
  if (ids.length === 0) return 0

  let total = 0
  const CHUNK = 500
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { count } = await sb
      .from(SUBS)
      .select('id', { count: 'exact', head: true })
      .in('id', ids.slice(i, i + CHUNK))
      .eq('status', 'unsubscribed')
    total += count ?? 0
  }
  return total
}
