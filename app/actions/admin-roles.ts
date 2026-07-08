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

/** List all platform users with engagement counts (superuser only).
 *
 * Auth (`auth.users`) is the source of truth for email + created_at — the
 * `profiles` table has neither (it carries display_name/phone keyed by
 * user_id). Engagement tables key on the auth user id.
 */
export async function listPlatformUsersForAdmin(): Promise<AdminPlatformUserRow[]> {
  const session = await getSession()
  const role = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (role?.role !== 'superuser') return []

  const supabase = createServiceClient()

  const authUsers: Array<{
    id: string
    email?: string | null
    phone?: string | null
    created_at: string
    updated_at?: string | null
    user_metadata?: Record<string, unknown>
  }> = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      console.error('[admin-roles] auth listUsers failed:', error.message)
      break
    }
    authUsers.push(...(data?.users ?? []))
    if (!data || data.users.length < 1000) break
  }

  const [profilesRes, savedListingsRes, savedSearchesRes, activitiesRes] = await Promise.all([
    supabase.from('profiles').select('user_id, display_name, phone, updated_at'),
    supabase.from('saved_listings').select('user_id'),
    supabase.from('saved_searches').select('user_id'),
    supabase.from('user_activities').select('user_id'),
  ])
  if (profilesRes.error) console.error('[admin-roles] profiles query failed:', profilesRes.error.message)
  if (savedListingsRes.error) console.error('[admin-roles] saved_listings query failed:', savedListingsRes.error.message)
  if (savedSearchesRes.error) console.error('[admin-roles] saved_searches query failed:', savedSearchesRes.error.message)
  if (activitiesRes.error) console.error('[admin-roles] user_activities query failed:', activitiesRes.error.message)

  const profileByUserId = new Map(
    ((profilesRes.data ?? []) as Array<{ user_id: string; display_name: string | null; phone: string | null; updated_at: string }>)
      .map((p) => [p.user_id, p])
  )

  const countByUser = (rows: Array<{ user_id: string | null }> | null | undefined) => {
    const map = new Map<string, number>()
    for (const row of rows ?? []) {
      if (!row.user_id) continue
      map.set(row.user_id, (map.get(row.user_id) ?? 0) + 1)
    }
    return map
  }

  const savedListingsMap = countByUser(savedListingsRes.data as Array<{ user_id: string | null }>)
  const savedSearchesMap = countByUser(savedSearchesRes.data as Array<{ user_id: string | null }>)
  const activitiesMap = countByUser(activitiesRes.data as Array<{ user_id: string | null }>)

  const metaString = (meta: Record<string, unknown> | undefined, key: string): string | null => {
    const value = meta?.[key]
    return typeof value === 'string' && value.trim() ? value : null
  }

  return authUsers
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .map((user) => {
      const profile = profileByUserId.get(user.id)
      const meta = user.user_metadata
      return {
        id: user.id,
        email: user.email ?? null,
        display_name: profile?.display_name ?? metaString(meta, 'full_name') ?? metaString(meta, 'name'),
        first_name: metaString(meta, 'first_name') ?? metaString(meta, 'given_name'),
        last_name: metaString(meta, 'last_name') ?? metaString(meta, 'family_name'),
        phone: profile?.phone ?? user.phone ?? null,
        created_at: user.created_at,
        updated_at: profile?.updated_at ?? user.updated_at ?? user.created_at,
        saved_listings_count: savedListingsMap.get(user.id) ?? 0,
        saved_searches_count: savedSearchesMap.get(user.id) ?? 0,
        activities_count: activitiesMap.get(user.id) ?? 0,
      }
    })
}
