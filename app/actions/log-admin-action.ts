'use server'

import { createServiceClient } from '@/lib/supabase/service'

export type LogAdminActionResult = { ok: true } | { ok: false; error: string }

/**
 * Append one admin_actions row. P12: never swallow insert errors — a silent
 * audit trail is worse than a loud failure for compliance surfaces.
 */
export async function logAdminAction(params: {
  adminEmail: string
  role: string | null
  actionType: string
  resourceType?: string | null
  resourceId?: string | null
  details?: Record<string, unknown> | null
}): Promise<LogAdminActionResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured' }
  }
  const email = (params.adminEmail ?? '').trim()
  if (!email) {
    return { ok: false, error: 'adminEmail required' }
  }
  const supabase = createServiceClient()
  const { error } = await supabase.from('admin_actions').insert({
    admin_email: email,
    role: params.role ?? null,
    action_type: params.actionType,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    details: params.details ?? null,
  })
  if (error) {
    console.error('[logAdminAction]', error.message, params.actionType)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
