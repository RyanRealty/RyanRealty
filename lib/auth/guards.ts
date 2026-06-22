import 'server-only'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail, type AdminRoleType } from '@/app/actions/admin-roles'
import { isValidCronAuth } from '@/lib/auth/cron-auth'

/**
 * Shared admin authorization guards (audit Step 1.3).
 *
 * The repo had ~6 different inline authz patterns across routes + server actions
 * (getAdminRoleForEmail any-role, isSuperuserAdmin superuser-only, raw CRON_SECRET
 * bearer, per-file requireAdmin reimplementations). This is the single source.
 *
 * Canonical chain: verified Supabase session (getSession) -> email -> admin role
 * (getAdminRoleForEmail, which already grants the hardcoded superuser + reads the
 * RLS-locked admin_roles via the service role). Same behavior the (protected)
 * layout already enforces — just reusable in route handlers + actions.
 */

export interface AdminContext {
  email: string
  role: AdminRoleType
  brokerId: string | null
}

/** Resolve the current admin (verified session + admin role), or null. Never throws. */
export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await getSession()
  const email = session?.user?.email
  if (!email) return null
  const role = await getAdminRoleForEmail(email)
  if (!role) return null
  return { email, role: role.role, brokerId: role.brokerId }
}

/**
 * Route-handler guard. Returns the AdminContext, or a 403 `Response` to return
 * early:
 *   const ctx = await requireAdminOr403()
 *   if (ctx instanceof Response) return ctx
 *   // ...ctx.email / ctx.role available
 */
export async function requireAdminOr403(): Promise<AdminContext | Response> {
  const ctx = await getAdminContext()
  if (!ctx) return new Response('Forbidden — admin access required', { status: 403 })
  return ctx
}

/** Route-handler guard requiring the superuser role specifically. */
export async function requireSuperuserOr403(): Promise<AdminContext | Response> {
  const ctx = await getAdminContext()
  if (!ctx || ctx.role !== 'superuser') {
    return new Response('Forbidden — superuser access required', { status: 403 })
  }
  return ctx
}

/**
 * For interactive admin endpoints that ALSO accept a CRON_SECRET bearer (so a
 * scheduled/automation caller still works). Returns true if the request carries
 * a valid admin session OR the cron secret. Closes the "gated only by a shared
 * CRON_SECRET" hole (audit p0.2b) without breaking any legitimate automation.
 */
export async function isAuthorizedAdminOrCron(req: Request): Promise<boolean> {
  const header = req.headers.get('authorization') ?? req.headers.get('x-cron-secret')
  if (isValidCronAuth(header, process.env.CRON_SECRET)) return true
  return (await getAdminContext()) !== null
}
