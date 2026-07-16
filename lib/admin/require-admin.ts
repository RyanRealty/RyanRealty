import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAdminContext } from '@/lib/auth/guards'
import { getCrmAccess } from '@/app/actions/crm'
import { createServiceClient } from '@/lib/supabase/service'
import { safeRedirectPath } from '@/lib/auth/safeRedirect'
import {
  hasCapability,
  type AdminCapabilityContext,
  type Capability,
} from '@/lib/admin/capabilities'

/**
 * The ONE authorization primitive (admin rebuild Foundation, spec 01 §4 +
 * 01-DECISIONS-AND-RECONCILIATION §A2). Kills RC5: every mutating action and every
 * admin route calls one of these IN-BODY, because a Next server action compiles to
 * an independently-invocable POST that the (protected) layout redirect never runs
 * on. The same capability map (lib/admin/capabilities.ts) drives the nav generator,
 * so what the nav shows and what the guard allows can never disagree.
 *
 * Three surfaces, three guards, one check (hasCapability):
 *  - requireAdminPage(cap)   RSC / layout  → redirects on failure
 *  - requireAdminAction(cap) server action → throws AdminAuthzError on failure
 *  - requireAdminRoute(cap)  route handler → returns a 401/403 Response on failure
 *
 * This EXTENDS the verified auth core (lib/auth/guards.ts getAdminContext); it does
 * not re-implement auth.
 */

/** Per-user flags layered on the role (schema-verified columns on admin_roles). */
const resolveAdminFlags = cache(
  async (email: string): Promise<{ canExport: boolean; pauseLeads: boolean }> => {
    // Superuser and any missing row default to the permissive/neutral flags; the
    // role check has already run in getAdminContext, so this only refines a known
    // admin. Service-role read: admin_roles is RLS-locked (same reason the role
    // resolver uses the service client). Email always comes from the verified
    // session, never user input.
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('admin_roles')
      .select('can_export, pause_leads')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()
    return {
      canExport: data?.can_export ?? true,
      pauseLeads: data?.pause_leads ?? false,
    }
  },
)

/**
 * Resolve the full capability context: verified session + role (getAdminContext) +
 * own-broker slug (getCrmAccess) + per-user flags. Null when the caller is not an
 * admin. Never throws. React-cached transitively (each dependency is memoized).
 */
export const getAdminCapabilityContext = cache(
  async (): Promise<AdminCapabilityContext | null> => {
    const ctx = await getAdminContext()
    if (!ctx) return null
    const [access, flags] = await Promise.all([getCrmAccess(), resolveAdminFlags(ctx.email)])
    return {
      email: ctx.email,
      role: ctx.role,
      brokerId: ctx.brokerId,
      brokerSlug: access?.brokerSlug ?? null,
      flags,
    }
  },
)

/** Thrown by requireAdminAction when the caller is missing/under-privileged. */
export class AdminAuthzError extends Error {
  readonly code: 'unauthenticated' | 'forbidden'
  readonly capability: Capability
  constructor(code: 'unauthenticated' | 'forbidden', capability: Capability) {
    super(
      code === 'unauthenticated'
        ? 'Admin sign-in required.'
        : `Missing capability: ${capability}.`,
    )
    this.name = 'AdminAuthzError'
    this.code = code
    this.capability = capability
  }
}

/** Current request path, for preserving the deep-link destination through auth. */
async function currentPath(): Promise<string> {
  const h = await headers()
  return h.get('x-pathname') || h.get('x-invoke-path') || '/admin'
}

/**
 * RSC / layout guard. Redirects an unauthenticated caller to sign-in with the
 * current destination preserved (fixes the hardcoded-next deep-link loss), and a
 * caller missing the capability to /admin/access-denied. Returns the context on
 * success. Structurally, the nav never shows what this denies — so the redirect is
 * the rare hand-typed-URL / expired-session path.
 */
export async function requireAdminPage(cap: Capability): Promise<AdminCapabilityContext> {
  const ctx = await getAdminCapabilityContext()
  if (!ctx) {
    const next = safeRedirectPath(await currentPath(), '/admin')
    redirect(`/auth-error?next=${encodeURIComponent(next)}`)
  }
  if (!hasCapability(ctx, cap)) {
    redirect(`/admin/access-denied?cap=${encodeURIComponent(cap)}`)
  }
  return ctx
}

/**
 * Server-action guard. Throws AdminAuthzError on failure (callers that prefer a
 * typed result should catch it, or use checkAdminAction). Returns the context on
 * success. This is the in-body defense the (protected) layout cannot provide.
 */
export async function requireAdminAction(cap: Capability): Promise<AdminCapabilityContext> {
  const ctx = await getAdminCapabilityContext()
  if (!ctx) throw new AdminAuthzError('unauthenticated', cap)
  if (!hasCapability(ctx, cap)) throw new AdminAuthzError('forbidden', cap)
  return ctx
}

/**
 * Non-throwing variant for actions that return a typed result union. Returns
 * `{ ok: true, ctx }` or `{ ok: false, error }`.
 */
export async function checkAdminAction(
  cap: Capability,
): Promise<
  | { ok: true; ctx: AdminCapabilityContext }
  | { ok: false; error: string; code: 'unauthenticated' | 'forbidden' }
> {
  const ctx = await getAdminCapabilityContext()
  if (!ctx) return { ok: false, error: 'Admin sign-in required.', code: 'unauthenticated' }
  if (!hasCapability(ctx, cap)) {
    return { ok: false, error: 'You do not have access to this action.', code: 'forbidden' }
  }
  return { ok: true, ctx }
}

/**
 * Route-handler guard. Returns the context, or a 401 (unauthenticated) / 403
 * (forbidden) Response to return early:
 *   const ctx = await requireAdminRoute('content.blog')
 *   if (ctx instanceof Response) return ctx
 */
export async function requireAdminRoute(
  cap: Capability,
): Promise<AdminCapabilityContext | Response> {
  const ctx = await getAdminCapabilityContext()
  if (!ctx) return new Response('Unauthorized — admin sign-in required', { status: 401 })
  if (!hasCapability(ctx, cap)) {
    return new Response(`Forbidden — missing capability: ${cap}`, { status: 403 })
  }
  return ctx
}
