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
import { cacheTag } from '@/lib/data/cache/unstable-cache'

export type BrokerSettingsResult = { ok: true } | { ok: false; error: string }

export type BrokerSettingsPayload = {
  notify_new_leads?: boolean
  notify_deal_activity?: boolean
  notify_task_due?: boolean
  /** Alert when an identified lead comes back and views a home. */
  notify_return_visit?: boolean
  /** Alert when a CMA draft finishes building. */
  notify_cma_ready?: boolean
  /** Opt-in for SMS lead/activity alerts (default OFF). Gates queueBrokerAlert. */
  notify_sms?: boolean
  /** Personal quiet window for internal alerts, local hour 0-23. null clears it. */
  notify_quiet_start_hour?: number | null
  notify_quiet_end_hour?: number | null
  /** Cap on alerts per rolling 24h. null clears it. */
  notify_max_per_day?: number | null
  email_signature?: string
  social_instagram?: string
  social_facebook?: string
  social_linkedin?: string
}

function sanitizeSocialUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.length > 500) return null
  if (!/^https:\/\//i.test(trimmed)) return null
  return trimmed
}

/** Local hour 0-23, or null to clear. Anything else is refused as null. */
function sanitizeHour(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null
}

/** 1-200 alerts per day, or null for unlimited. Mirrors the CHECK constraint. */
function sanitizeMaxPerDay(raw: number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : null
}

function bust(brokerId: string) {
  revalidateTag('broker-settings', 'max')
  // getBrokerTelephony (the SMS opt-in source for queueBrokerAlert) is tagged here.
  revalidateTag(cacheTag.brokers, 'max')
  revalidatePath('/admin/settings')
  revalidatePath('/admin/settings/account')
  revalidatePath('/admin/today')
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
  if (typeof payload.notify_return_visit === 'boolean') update.notify_return_visit = payload.notify_return_visit
  if (typeof payload.notify_cma_ready === 'boolean') update.notify_cma_ready = payload.notify_cma_ready
  if (typeof payload.notify_sms === 'boolean') update.notify_sms = payload.notify_sms
  // Volume controls. `null` is a meaningful value here (clears the setting), so
  // these check for `undefined` rather than truthiness — 0 is also a valid hour.
  if (payload.notify_quiet_start_hour !== undefined)
    update.notify_quiet_start_hour = sanitizeHour(payload.notify_quiet_start_hour)
  if (payload.notify_quiet_end_hour !== undefined)
    update.notify_quiet_end_hour = sanitizeHour(payload.notify_quiet_end_hour)
  if (payload.notify_max_per_day !== undefined)
    update.notify_max_per_day = sanitizeMaxPerDay(payload.notify_max_per_day)
  if (typeof payload.email_signature === 'string') update.email_signature = payload.email_signature.slice(0, 4000)
  if (typeof payload.social_instagram === 'string') update.social_instagram = sanitizeSocialUrl(payload.social_instagram)
  if (typeof payload.social_facebook === 'string') update.social_facebook = sanitizeSocialUrl(payload.social_facebook)
  if (typeof payload.social_linkedin === 'string') update.social_linkedin = sanitizeSocialUrl(payload.social_linkedin)

  if (Object.keys(update).length === 0) return { ok: true }

  const sb = createServiceClient()
  const { error } = await sb.from('brokers').update(update).eq('id', bid)
  if (error) return { ok: false, error: error.message }

  bust(bid)
  return { ok: true }
}

export type GmailSignatureSyncActionResult =
  | { ok: true; mailboxes: Array<{ mailbox: string; signatureChars: number }> }
  | { ok: false; error: string }

/**
 * Pull the signed-in broker's REAL Gmail signature into brokers.gmail_signature_html
 * so every CRM email matches Gmail exactly (superusers sync all three mailboxes).
 * Also runs automatically every ~6h via the crm-gmail-sync cron.
 */
export async function syncGmailSignatureAction(): Promise<GmailSignatureSyncActionResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }
  if (access.role !== 'superuser' && access.role !== 'broker') {
    return { ok: false, error: 'Not authorized' }
  }

  const { syncGmailSignatures } = await import('@/lib/crm/gmail-signature-sync')
  const only = access.role === 'superuser' ? undefined : access.email
  const results = await syncGmailSignatures(only)
  if (results.length === 0) {
    return { ok: false, error: 'Your login email does not match a CRM mailbox' }
  }
  const failed = results.filter((r) => !r.ok)
  if (failed.length === results.length) {
    return { ok: false, error: failed[0].error ?? 'Sync failed' }
  }

  revalidateTag('broker-settings', 'max')
  revalidateTag(cacheTag.brokers, 'max')
  revalidatePath('/admin/settings')
  return {
    ok: true,
    mailboxes: results.filter((r) => r.ok).map((r) => ({ mailbox: r.mailbox, signatureChars: r.signatureChars })),
  }
}
