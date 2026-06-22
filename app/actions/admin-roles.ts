'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isSuperuserAdmin } from '@/lib/admin'
import { getSession } from '@/app/actions/auth'
import { logAdminAction } from '@/app/actions/log-admin-action'

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

export type AdminPlatformUserRow = {
  id: string
  email: string | null
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  created_at: string
  updated_at: string
  saved_listings_count: number
  saved_searches_count: number
  activities_count: number
}

/** Get admin role for an email. Returns role if in admin_roles; superuser if isSuperuserAdmin(email). */
export async function getAdminRoleForEmail(email: string | null | undefined): Promise<{ role: AdminRoleType; brokerId: string | null } | null> {
  if (!email || typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return null
  if (isSuperuserAdmin(trimmed)) return { role: 'superuser', brokerId: null }
  // Service-role read: admin_roles is RLS-locked, and the broker's own session
  // cannot see its row (this silently denied Rebecca + Paul until 2026-06-09).
  // The email always comes from the verified Supabase session, never user input.
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('admin_roles')
    .select('role, broker_id')
    .eq('email', trimmed)
    .maybeSingle()
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
  // Caller guard (audit p0.2d): managing admin roles is superuser-only. This is a
  // 'use server' action = a public POST endpoint; without this check anyone could
  // grant themselves a broker/report_viewer role via the service-role write.
  const session = await getSession()
  const actorEmail = session?.user?.email ?? null
  const actorRole = actorEmail ? (await getAdminRoleForEmail(actorEmail))?.role ?? null : null
  if (actorRole !== 'superuser') return { ok: false, error: 'Forbidden — superuser access required' }

  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { ok: false, error: 'Email is required' }
  if (role === 'superuser' && !isSuperuserAdmin(trimmed)) return { ok: false, error: 'Only the designated superuser can be set as superuser.' }
  const supabase = createServiceClient()
  const { error } = await supabase.from('admin_roles').upsert(
    { email: trimmed, role, broker_id: brokerId || null, updated_at: new Date().toISOString() },
    { onConflict: 'email' }
  )
  if (error) return { ok: false, error: error.message }
  await logAdminAction({ adminEmail: actorEmail ?? '', role: actorRole, actionType: 'upsert', resourceType: 'admin_role', resourceId: trimmed, details: { role, broker_id: brokerId ?? null } })
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  return { ok: true }
}

/** Remove admin access for an email. Only superuser. */
export async function removeAdminRole(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  // Caller guard (audit p0.2d): removing admin roles is superuser-only.
  const session = await getSession()
  const actorEmail = session?.user?.email ?? null
  const actorRole = actorEmail ? (await getAdminRoleForEmail(actorEmail))?.role ?? null : null
  if (actorRole !== 'superuser') return { ok: false, error: 'Forbidden — superuser access required' }

  if (isSuperuserAdmin(email)) return { ok: false, error: 'Cannot remove the superuser.' }
  const supabase = createServiceClient()
  const { error } = await supabase.from('admin_roles').delete().eq('email', email.trim().toLowerCase())
  if (error) return { ok: false, error: error.message }
  await logAdminAction({ adminEmail: actorEmail ?? '', role: actorRole, actionType: 'delete', resourceType: 'admin_role', resourceId: email.trim().toLowerCase() })
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  return { ok: true }
}

/** List all platform users with engagement counts (superuser only). */
export async function listPlatformUsersForAdmin(): Promise<AdminPlatformUserRow[]> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (role?.role !== 'superuser') return []

  const supabase = createServiceClient()
  const [profilesRes, savedListingsRes, savedSearchesRes, activitiesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, display_name, first_name, last_name, phone, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase.from('saved_listings').select('user_id'),
    supabase.from('saved_searches').select('user_id'),
    supabase.from('user_activities').select('user_id'),
  ])
  if (profilesRes.error) console.error('[admin-roles] profiles query failed:', profilesRes.error.message)
  if (savedListingsRes.error) console.error('[admin-roles] saved_listings query failed:', savedListingsRes.error.message)
  if (savedSearchesRes.error) console.error('[admin-roles] saved_searches query failed:', savedSearchesRes.error.message)
  if (activitiesRes.error) console.error('[admin-roles] user_activities query failed:', activitiesRes.error.message)
  const { data: profiles } = profilesRes
  const { data: savedListings } = savedListingsRes
  const { data: savedSearches } = savedSearchesRes
  const { data: activities } = activitiesRes

  const countByUser = (rows: Array<{ user_id: string | null }> | null | undefined) => {
    const map = new Map<string, number>()
    for (const row of rows ?? []) {
      if (!row.user_id) continue
      map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1)
    }
    return map
  }

  const savedListingsMap = countByUser(savedListings as Array<{ user_id: string | null }>)
  const savedSearchesMap = countByUser(savedSearches as Array<{ user_id: string | null }>)
  const activitiesMap = countByUser(activities as Array<{ user_id: string | null }>)

  return ((profiles ?? []) as Array<{
    id: string
    email: string | null
    display_name: string | null
    first_name: string | null
    last_name: string | null
    phone: string | null
    created_at: string
    updated_at: string
  }>).map((row) => ({
    ...row,
    saved_listings_count: savedListingsMap.get(row.id) ?? 0,
    saved_searches_count: savedSearchesMap.get(row.id) ?? 0,
    activities_count: activitiesMap.get(row.id) ?? 0,
  }))
}
