'use server'

/**
 * §9 My Settings — a broker edits their OWN row on the brokers table.
 *
 * Only the notification prefs and email signature are exposed here. Identity
 * fields (display_name, title, photo, social) remain on the AdminBrokerForm
 * in /admin/brokers/edit. Role-scoped: the signed-in broker may only touch
 * their own row (matched by email). Superusers may patch any row by brokerId.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'

export type BrokerSettingsResult = { ok: true } | { ok: false; error: string }

export type BrokerSettingsPayload = {
  notify_new_leads?: boolean
  notify_deal_activity?: boolean
  notify_task_due?: boolean
  email_signature?: string
}

function bust(brokerId: string) {
  revalidateTag('broker-settings', 'max')
  revalidatePath('/admin/settings')
  revalidatePath(`/admin/brokers/edit?id=${brokerId}`)
}

/**
 * Update the signed-in broker's own notification prefs / email signature.
 * Works for both broker role (own row only) and superuser (any row by brokerId).
 */
export async function saveBrokerSettingsAction(
  brokerId: string,
  payload: BrokerSettingsPayload,
): Promise<BrokerSettingsResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }

  const bid = String(brokerId ?? '').trim()
  if (!bid) return { ok: false, error: 'Missing broker id' }

  // Broker role: verify the target broker is their own row
  if (access.role === 'broker') {
    // Resolve the broker id that belongs to the signed-in email
    const sb = createServiceClient()
    const { data: row } = await sb
      .from('brokers')
      .select('id')
      .eq('email', access.email)
      .single()
    if (!row || row.id !== bid) {
      return { ok: false, error: 'You can only edit your own settings' }
    }
  } else if (access.role !== 'superuser') {
    return { ok: false, error: 'Not authorized' }
  }

  // Sanitize — only allow the declared columns
  const update: Record<string, unknown> = {}
  if (typeof payload.notify_new_leads === 'boolean') update.notify_new_leads = payload.notify_new_leads
  if (typeof payload.notify_deal_activity === 'boolean') update.notify_deal_activity = payload.notify_deal_activity
  if (typeof payload.notify_task_due === 'boolean') update.notify_task_due = payload.notify_task_due
  if (typeof payload.email_signature === 'string') update.email_signature = payload.email_signature.slice(0, 4000)

  if (Object.keys(update).length === 0) return { ok: true }

  const sb = createServiceClient()
  const { error } = await sb.from('brokers').update(update).eq('id', bid)
  if (error) return { ok: false, error: error.message }

  bust(bid)
  return { ok: true }
}
