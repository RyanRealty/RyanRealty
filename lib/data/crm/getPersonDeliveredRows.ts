/**
 * getPersonDeliveredRows — a contact's newest `email_delivered` timeline rows,
 * read apart from the rest of the timeline (Matt 2026-10-15: show delivered on
 * the contact timeline).
 *
 * A delivery row lands for every email we send, so a contact on a daily listing
 * alert gains one a day. The person tools page reads its timeline as one
 * newest-100 window; with deliveries inside it, a month of alerts would push the
 * contact's real texts, calls and notes out of view. getCrmPersonFull reads the
 * window without deliveries and merges these in (lib/crm/email-lifecycle-kinds.ts).
 */
import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { EMAIL_DELIVERED_KIND } from '@/lib/crm/email-lifecycle-kinds'

export type DeliveredTimelineRow = {
  id: number
  ts: string
  kind: string
  title: string | null
  body: string | null
  source: string
  broker: string | null
  payload: Record<string, unknown>
  starred?: boolean
}

export async function getPersonDeliveredRows(
  personId: number,
  limit = 30,
): Promise<{ rows: DeliveredTimelineRow[]; total: number }> {
  if (!Number.isFinite(personId) || personId <= 0) return { rows: [], total: 0 }
  const sb = createServiceClient()
  const { data, count } = await sb
    .from('crm_timeline')
    .select('id,ts,kind,title,body,source,broker,payload,starred', { count: 'exact' })
    .eq('person_id', personId)
    .eq('kind', EMAIL_DELIVERED_KIND)
    .order('ts', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100))
  return { rows: (data ?? []) as DeliveredTimelineRow[], total: count ?? 0 }
}
