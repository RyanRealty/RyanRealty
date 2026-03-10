'use server'

import { createClient } from '@/lib/supabase/server'

export type AdminActionRow = {
  id: string
  admin_email: string
  role: string | null
  action_type: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export async function getAdminActions(params: {
  limit?: number
  offset?: number
  adminEmail?: string | null
  actionType?: string | null
}): Promise<AdminActionRow[]> {
  const supabase = await createClient()
  let query = supabase
    .from('admin_actions')
    .select('id, admin_email, role, action_type, resource_type, resource_id, details, created_at')
    .order('created_at', { ascending: false })
    .range(params.offset ?? 0, (params.offset ?? 0) + (params.limit ?? 50) - 1)
  if (params.adminEmail?.trim()) {
    query = query.eq('admin_email', params.adminEmail.trim().toLowerCase())
  }
  if (params.actionType?.trim()) {
    query = query.eq('action_type', params.actionType.trim())
  }
  const { data } = await query
  return (data ?? []) as AdminActionRow[]
}
