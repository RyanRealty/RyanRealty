/**
 * Reads that seed deal-team contacts from cycle.raw.
 * Raw .from() stays here (G1). Inserts stay in app/actions/tc-contacts.ts.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export async function countDealContacts(dealId: string): Promise<number> {
  const { count } = await createServiceClient()
    .from('tc_deal_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId)
  return count ?? 0
}

export async function getCycleRawForDeal(dealId: string): Promise<unknown[]> {
  const { data } = await createServiceClient().from('tc_cycles').select('raw').eq('deal_id', dealId)
  return (data ?? []).map((c) => c.raw)
}
