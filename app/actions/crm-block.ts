'use server'

/**
 * Block / unblock an inbound number (spam control). A blocked number's calls are
 * rejected and texts dropped by the Twilio webhooks. Matched on last-10 digits.
 */
import { revalidatePath } from 'next/cache'
import { requireCrmAccess } from '@/app/actions/crm'
import { createServiceClient } from '@/lib/supabase/service'

type Result = { ok: true; blocked: boolean } | { ok: false; error: string }

function normalize(phone: string): { ten: string; e164: string } | null {
  const d = String(phone ?? '').replace(/\D/g, '')
  if (d.length < 10) return null
  const ten = d.slice(-10)
  return { ten, e164: `+1${ten}` }
}

export async function blockCrmNumber(phone: string, opts?: { reason?: string; note?: string }): Promise<Result> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const n = normalize(phone)
  if (!n) return { ok: false, error: 'A valid phone number is required.' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_blocked_numbers').upsert(
    {
      phone_last10: n.ten,
      e164: n.e164,
      reason: opts?.reason ?? 'manual',
      blocked_by: access.access.brokerSlug ?? 'matt',
      note: opts?.note ?? null,
    },
    { onConflict: 'phone_last10' },
  )
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/console/leads', 'layout')
  return { ok: true, blocked: true }
}

export async function unblockCrmNumber(phone: string): Promise<Result> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const n = normalize(phone)
  if (!n) return { ok: false, error: 'A valid phone number is required.' }
  const sb = createServiceClient()
  const { error } = await sb.from('crm_blocked_numbers').delete().eq('phone_last10', n.ten)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/console/leads', 'layout')
  return { ok: true, blocked: false }
}
