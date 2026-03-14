'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isSuperuserAdmin } from '@/lib/admin'
import { getSession } from '@/app/actions/auth'
import { logAdminAction } from '@/app/actions/log-admin-action'

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) throw new Error('Supabase service role not configured')
  return createClient(url, key)
}

export type AdminRoleType = 'superuser' | 'broker' | 'report_viewer'

export type AdminRoleRow = {
  id: string
  email: string
  role: AdminRoleType
  broker_id: string | null
  user_id: string | null
  created_at: string
  updated_at: string
}

/** Get admin role for an email. Returns role if in admin_roles; superuser if isSuperuserAdmin(email). */
export async function getAdminRoleForEmail(email: string | null | undefined): Promise<{ role: AdminRoleType; brokerId: string | null } | null> {
  if (!email || typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return null
  if (isSuperuserAdmin(trimmed)) return { role: 'superuser', brokerId: null }
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('admin_roles')
    .select('role, broker_id')
    .eq('email', trimmed)
    .single()
  if (!data) return null
  return { role: data.role as AdminRoleType, brokerId: data.broker_id ?? null }
}

/** List all admin users (admin_roles rows). Only superuser should call this. */
export async function listAdminRoles(): Promise<AdminRoleRow[]> {
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('admin_roles')
    .select('id, email, role, broker_id, user_id, created_at, updated_at')
    .order('email', { ascending: true })
  return (data ?? []) as AdminRoleRow[]
}

/** Add or update admin user. Only superuser. */
export async function upsertAdminRole(
  email: string,
  role: AdminRoleType,
  brokerId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { ok: false, error: 'Email is required' }
  if (role === 'superuser' && !isSuperuserAdmin(trimmed)) return { ok: false, error: 'Only the designated superuser can be set as superuser.' }
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('admin_roles').upsert(
    { email: trimmed, role, broker_id: brokerId || null, updated_at: new Date().toISOString() },
    { onConflict: 'email' }
  )
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const actorRole = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({ adminEmail: session?.user?.email ?? '', role: actorRole, actionType: 'upsert', resourceType: 'admin_role', resourceId: trimmed, details: { role, broker_id: brokerId ?? null } })
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  return { ok: true }
}

/** Remove admin access for an email. Only superuser. */
export async function removeAdminRole(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isSuperuserAdmin(email)) return { ok: false, error: 'Cannot remove the superuser.' }
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('admin_roles').delete().eq('email', email.trim().toLowerCase())
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const actorRole = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({ adminEmail: session?.user?.email ?? '', role: actorRole, actionType: 'delete', resourceType: 'admin_role', resourceId: email.trim().toLowerCase() })
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  return { ok: true }
}
