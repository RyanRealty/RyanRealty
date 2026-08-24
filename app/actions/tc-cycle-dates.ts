'use server'

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { syncDealCalendar } from '@/lib/tc/deal-calendar'

export async function saveCycleContingencyDays(input: {
  cycleId: string
  dealId: string
  propertyKey: string
  inspectionDays: string
  financingDays: string
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession()
  const email = session?.user?.email ?? null
  const role = await getAdminRoleForEmail(email)
  if (!email || !role) return { ok: false, error: 'Not authorized' }
  const inspect = input.inspectionDays.trim() === '' ? null : Number(input.inspectionDays)
  const fin = input.financingDays.trim() === '' ? null : Number(input.financingDays)
  if (inspect != null && (!Number.isFinite(inspect) || inspect < 0 || inspect > 365)) {
    return { ok: false, error: 'Inspection days must be 0–365.' }
  }
  if (fin != null && (!Number.isFinite(fin) || fin < 0 || fin > 365)) {
    return { ok: false, error: 'Financing days must be 0–365.' }
  }
  const { error } = await createServiceClient()
    .from('tc_cycles')
    .update({ inspection_days: inspect, financing_days: fin })
    .eq('id', input.cycleId)
  if (error) return { ok: false, error: error.message }
  await syncDealCalendar(input.dealId)
  revalidatePath(`/admin/deals/${encodeURIComponent(input.propertyKey)}`)
  return { ok: true }
}
