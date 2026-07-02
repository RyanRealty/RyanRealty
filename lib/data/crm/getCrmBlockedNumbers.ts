import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * getCrmBlockedNumbers — reader for the inbound phone block list
 * (crm_blocked_numbers, enforced by the Twilio webhooks via isNumberBlocked:
 * blocked calls are rejected, blocked texts dropped).
 *
 * Uncached on purpose, same as isNumberBlocked — the block-list admin page is
 * force-dynamic and a block/unblock must be visible immediately after the
 * action revalidates. The table is tiny (spam numbers added by hand).
 *
 * DAL boundary (G1): the raw .from() lives here, inside lib/data/.
 */

export type CrmBlockedNumber = {
  id: number
  phoneLast10: string
  e164: string | null
  reason: string | null
  blockedBy: string | null
  note: string | null
  createdAt: string
}

export async function getCrmBlockedNumbers(): Promise<CrmBlockedNumber[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_blocked_numbers')
    .select('id, phone_last10, e164, reason, blocked_by, note, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('[getCrmBlockedNumbers]', error.message)
    return []
  }
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    phoneLast10: String(r.phone_last10 ?? ''),
    e164: (r.e164 as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    blockedBy: (r.blocked_by as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    createdAt: String(r.created_at ?? ''),
  }))
}
