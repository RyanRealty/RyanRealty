import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

/**
 * A file's full audit trail (tc_events), newest first, one page at a time —
 * the file workspace's Activity tab (Matt 2026-09-24). Mail and text filings
 * are left out here as on the deal page (their own Email tab lists them).
 */
export type DealEventRow = {
  id: number
  actor: string
  action: string
  detail: Record<string, unknown>
  created_at: string
}

export async function listDealEvents(
  dealId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ rows: DealEventRow[]; total: number }> {
  const limit = Math.max(1, Math.min(200, opts.limit ?? 50))
  const offset = Math.max(0, opts.offset ?? 0)
  const { data, count, error } = await createServiceClient()
    .from('tc_events')
    .select('id, actor, action, detail, created_at', { count: 'exact' })
    .eq('deal_id', dealId)
    .not('action', 'in', '(mail_filed,sms_filed)')
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) {
    console.error('[deal-events] tc_events read failed:', error.message)
    return { rows: [], total: 0 }
  }
  return {
    rows: ((data ?? []) as DealEventRow[]).map((r) => ({ ...r, detail: (r.detail as Record<string, unknown>) ?? {} })),
    total: count ?? 0,
  }
}
