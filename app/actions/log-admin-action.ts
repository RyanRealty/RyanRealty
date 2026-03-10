'use server'

import { createClient } from '@supabase/supabase-js'

export async function logAdminAction(params: {
  adminEmail: string
  role: string | null
  actionType: string
  resourceType?: string | null
  resourceId?: string | null
  details?: Record<string, unknown> | null
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return
  const supabase = createClient(url, serviceKey)
  await supabase.from('admin_actions').insert({
    admin_email: params.adminEmail.trim(),
    role: params.role ?? null,
    action_type: params.actionType,
    resource_type: params.resourceType ?? null,
    resource_id: params.resourceId ?? null,
    details: params.details ?? null,
  })
}
