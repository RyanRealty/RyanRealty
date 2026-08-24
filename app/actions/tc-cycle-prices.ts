'use server'

import { revalidatePath } from 'next/cache'
import { checkAdminAction } from '@/lib/admin/require-admin'
import { updateCyclePrices } from '@/lib/data/tc/cycle-prices'
import { parsePositiveMoney } from '@/lib/tc/oref-fill'

export async function saveCyclePrices(input: {
  cycleId: string
  propertyKey: string
  listingPrice: string
  salePrice: string
}): Promise<{ ok: boolean; error?: string }> {
  const gate = await checkAdminAction('transactions.edit')
  if (!gate.ok) return { ok: false, error: gate.error }
  const listing = parsePositiveMoney(input.listingPrice)
  const sale = parsePositiveMoney(input.salePrice)
  if (!listing.ok) return { ok: false, error: 'List price must be a positive dollar amount.' }
  if (!sale.ok) return { ok: false, error: 'Sale price must be a positive dollar amount.' }
  const res = await updateCyclePrices({
    cycleId: input.cycleId,
    listingPrice: listing.value,
    salePrice: sale.value,
  })
  if (!res.ok) return { ok: false, error: res.error }
  revalidatePath(`/admin/deals/${encodeURIComponent(input.propertyKey)}`)
  return { ok: true }
}
