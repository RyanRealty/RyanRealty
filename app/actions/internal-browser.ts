'use server'

import { cookies, headers } from 'next/headers'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { internalUserCookie } from '@/lib/analytics/internal-user-cookie'

/**
 * Marks this browser internal (`rr_internal=1`, a year) when, and only when, the
 * caller is signed in AND holds an admin role (broker, admin, superuser, any
 * row in admin_roles). Called by the admin sign-in form after One Tap and, on
 * every authenticated admin page load, by /api/admin/internal-browser (which
 * InternalBrowserMark in the protected layout posts to), so a broker already signed in before 2026-10-05 is marked on their
 * next admin visit without signing in again. A visitor who is not an admin gets
 * nothing. Matt 2026-10-05: GA4 counts only outside visitors.
 */
export async function markInternalBrowser(): Promise<{ marked: boolean }> {
  try {
    const session = await getSession()
    const email = session?.user?.email
    if (!email) return { marked: false }
    const role = await getAdminRoleForEmail(email)
    if (!role) return { marked: false }
    const h = await headers()
    const cookie = internalUserCookie(h.get('x-forwarded-host') || h.get('host'))
    const jar = await cookies()
    jar.set(cookie.name, cookie.value, cookie.options)
    return { marked: true }
  } catch (err) {
    console.warn('[internal-browser] mark failed:', err instanceof Error ? err.message : String(err))
    return { marked: false }
  }
}
