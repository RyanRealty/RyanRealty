/**
 * Cycle list/sale price writes. Raw .from() stays here (G1).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export async function updateCyclePrices(input: {
  cycleId: string
  listingPrice: number | null
  salePrice: number | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await createServiceClient()
    .from('tc_cycles')
    .update({ listing_price: input.listingPrice, sale_price: input.salePrice })
    .eq('id', input.cycleId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
