'use server'

/**
 * CRM broker config mutations (Wave 2). The broker roster + its CRM flags live on
 * the brokers table (migration 20260625172000_crm_brokers_config). These actions
 * make the CRM-facing flags editable from /admin/crm/settings/brokers instead of
 * a code constant. Read side: lib/data/crm/getCrmBrokers.ts (cached, tag
 * 'crm-brokers'). Owner/superuser only — the broker roster is a system-of-record
 * config a non-owner must never mutate.
 */

import { revalidatePath, revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'

export type CrmBrokerResult = { ok: true } | { ok: false; error: string }

async function requireOwner(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authorized' }
  if (access.role !== 'superuser') return { ok: false, error: 'Only the owner can change the broker roster' }
  return { ok: true }
}

function bust() {
  revalidateTag('crm-brokers', 'max')
  revalidatePath('/admin/crm/settings/brokers')
}

async function setBrokerFlag(crmSlug: string, column: 'crm_active' | 'routing_eligible', value: boolean): Promise<CrmBrokerResult> {
  const gate = await requireOwner()
  if (!gate.ok) return gate
  const slug = String(crmSlug ?? '').trim()
  if (!slug) return { ok: false, error: 'Missing broker' }
  const sb = createServiceClient()
  const { error } = await sb.from('brokers').update({ [column]: value }).eq('crm_slug', slug)
  if (error) return { ok: false, error: error.message }
  bust()
  return { ok: true }
}

/** Toggle whether a broker is active inside the CRM (pickers, assignment, lists). */
export async function setCrmBrokerActiveAction(formData: FormData): Promise<CrmBrokerResult> {
  return setBrokerFlag(String(formData.get('crmSlug') ?? ''), 'crm_active', String(formData.get('value') ?? '') === 'on')
}

/** Toggle whether a broker may receive round-robin lead routing. */
export async function setCrmBrokerRoutingEligibleAction(formData: FormData): Promise<CrmBrokerResult> {
  return setBrokerFlag(String(formData.get('crmSlug') ?? ''), 'routing_eligible', String(formData.get('value') ?? '') === 'on')
}
