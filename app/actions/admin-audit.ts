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

/**
 * Read the admin audit trail.
 *
 * Returns the error instead of swallowing it. This used to end
 * `const { data } = await query; return (data ?? [])`, which meant the read
 * could not fail — only come back empty. It did fail, for months: the RLS
 * policy on admin_actions consults admin_roles, whose own policy recursed into
 * itself and raised 42P17 on every authenticated read. The screen showed "No
 * admin action has been recorded." A compliance surface that reports a clean
 * history when it cannot read the table is worse than one that is down, so the
 * failure is now surfaced (migration 20260809010000 fixed the recursion).
 */
export async function getAdminActions(params: {
  limit?: number
  offset?: number
  adminEmail?: string | null
  actionType?: string | null
}): Promise<{ rows: AdminActionRow[]; error: string | null }> {
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
  const { data, error } = await query
  if (error) {
    console.error('[admin-audit] admin_actions read failed:', error.message)
    return { rows: [], error: error.message }
  }
  return { rows: (data ?? []) as AdminActionRow[], error: null }
}
