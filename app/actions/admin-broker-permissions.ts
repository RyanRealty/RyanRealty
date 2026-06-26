'use server'

/**
 * §8.7 Team management — per-broker permission flag mutations on admin_roles.
 *
 * Guards: superuser only (the caller must be the owner). Each action validates
 * the target email, flips the named flag, and revalidates the team page.
 *
 * The last_seen_at / last_seen_platform columns are written by middleware or the
 * session layer rather than here — they are read-only from these actions.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'

export type BrokerPermResult = { ok: true } | { ok: false; error: string }

async function requireSuperuser(): Promise<BrokerPermResult> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }
  if (access.role !== 'superuser') return { ok: false, error: 'Superuser only' }
  return { ok: true }
}

function bust() {
  revalidateTag('admin-roles', 'max')
  revalidatePath('/admin/crm/settings/team')
}

async function setAdminRoleFlag(
  email: string,
  column: 'can_export' | 'pause_leads',
  value: boolean,
): Promise<BrokerPermResult> {
  const gate = await requireSuperuser()
  if (!gate.ok) return gate
  const e = String(email ?? '').trim().toLowerCase()
  if (!e) return { ok: false, error: 'Missing email' }
  const sb = createServiceClient()
  const { error } = await sb
    .from('admin_roles')
    .update({ [column]: value })
    .eq('email', e)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Toggle whether a broker may export contacts from the CRM. */
export async function setCanExportAction(formData: FormData): Promise<BrokerPermResult> {
  return setAdminRoleFlag(
    String(formData.get('email') ?? ''),
    'can_export',
    String(formData.get('value') ?? '') === 'on',
  )
}

/** Toggle whether the lead router pauses on this broker (vacation / capacity). */
export async function setPauseLeadsAction(formData: FormData): Promise<BrokerPermResult> {
  return setAdminRoleFlag(
    String(formData.get('email') ?? ''),
    'pause_leads',
    String(formData.get('value') ?? '') === 'on',
  )
}
